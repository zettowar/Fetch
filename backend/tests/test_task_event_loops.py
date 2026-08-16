"""Celery tasks must survive being run more than once in a worker process.

The defect this guards: task bodies run under `asyncio.run()`, which builds a
NEW event loop each invocation, while the app's shared `async_session` is backed
by a POOLED engine. A pooled asyncpg connection belongs to the loop that opened
it, so the first task in a worker process succeeds and hands its connection back
to the pool, and the next one to run in that process picks up a connection from
a dead loop and dies with:

    InterfaceError: cannot perform operation: another operation is in progress

On a live production stack `pick_current_winner_task` — the Top Dog / Top Cat
computation, the whole premise of the app — failed 4 out of 4, while
`purge_refresh_tokens_task` succeeded on a fresh worker process and failed on an
already-used one.

The existing suite could not see this: every test invoked a given task at most
once per process, which is precisely the one case that works. So each test here
calls the task TWICE. One call proves nothing.
"""
import asyncio

import pytest

from app.config import settings
from app.tasks import announcements, digest, token_cleanup, weekly_recap, weekly_winner
from tests.conftest import TEST_DATABASE_URL


@pytest.fixture(autouse=True)
def task_db_points_at_the_test_database(monkeypatch):
    """Send the tasks' OWN engine to the test database.

    These tasks are deliberately called with no injected session_factory,
    because the code path under test is the one that builds its own engine —
    injecting a factory short-circuits exactly the thing being verified. But
    that engine is built from `settings.DATABASE_URL`, which is the *dev*
    database, so without this fixture the suite quietly reads and DELETES real
    dev rows (`_purge` removes refresh tokens). Redirect the setting instead.
    """
    monkeypatch.setattr(settings, "DATABASE_URL", TEST_DATABASE_URL)


def _run_twice(label: str, make_coro):
    """Two separate event loops, back to back, in this one process."""
    for attempt in (1, 2):
        try:
            asyncio.run(make_coro())
        except Exception as exc:  # noqa: BLE001
            if "another operation is in progress" in str(exc):
                pytest.fail(
                    f"{label} failed on invocation {attempt}: the task is using a "
                    "pooled connection across asyncio.run() event loops. Use "
                    "app.tasks._session.task_session."
                )
            raise


def test_the_redirect_fixture_actually_took_effect():
    """Guards the guard. If this ever regresses, every test below is silently
    operating on the dev database instead of proving anything."""
    assert settings.DATABASE_URL == TEST_DATABASE_URL
    assert settings.DATABASE_URL.endswith("_test")


def test_weekly_winner_compute_runs_twice():
    _run_twice("weekly_winner._compute", lambda: weekly_winner._compute())


def test_pick_current_winner_runs_twice():
    """The crown. This is the task that failed 4/4 in production."""
    _run_twice("weekly_winner._pick_current", lambda: weekly_winner._pick_current())


def test_token_cleanup_runs_twice():
    _run_twice("token_cleanup._purge", lambda: token_cleanup._purge())


def test_weekly_recap_runs_twice():
    _run_twice("weekly_recap._run", lambda: weekly_recap._run())


def test_digest_runs_twice(monkeypatch):
    """digest returns before opening a session when no email provider is set,
    so without a key this test would exercise nothing at all."""
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_fake_key_for_this_test")
    _run_twice("digest._run", lambda: digest._run())


def test_announcements_dispatch_runs_twice():
    import uuid

    missing = uuid.uuid4()
    # A nonexistent id returns early, but only AFTER opening a session — which
    # is all this needs to exercise.
    _run_twice("announcements._dispatch", lambda: announcements._dispatch(missing))


def test_no_task_module_reaches_for_the_shared_pooled_session():
    """The structural guard.

    The runtime tests above only catch a task that actually touches the database
    on the path they exercise. This catches the import itself, so a new task
    written against `app.db.async_session` fails here even if its own test only
    ever runs it once.
    """
    import pathlib

    tasks_dir = pathlib.Path(weekly_winner.__file__).parent
    offenders = []
    for path in sorted(tasks_dir.glob("*.py")):
        if path.name == "_session.py":  # documents the hazard in its docstring
            continue
        for lineno, line in enumerate(path.read_text().splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            if "async_session" in stripped:
                offenders.append(f"{path.name}:{lineno}: {stripped}")

    assert not offenders, (
        "task modules must use app.tasks._session.task_session, not the app's "
        "pooled async_session:\n  " + "\n  ".join(offenders)
    )
