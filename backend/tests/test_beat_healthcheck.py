"""The Celery Beat container's healthcheck decision.

This probe gates `docker compose up --wait`, which `make deploy` blocks on — so
a wrong answer here does not just mislead, it aborts the deploy. The case that
matters most is the one with no data at all.
"""
import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

# deploy/ is not an importable package, so load the probe by path. It sits in a
# different place depending on where the suite runs: bind-mounted at
# /app/deploy in the dev container, at /app in the production image, and
# alongside the repo when pytest is run from a checkout. Missing entirely is an
# ERROR, never a skip — a silently skipped test is how this logic went
# untested in the first place.
_CANDIDATES = [
    Path("/app/deploy/beat_healthcheck.py"),
    Path("/app/beat_healthcheck.py"),
    Path(__file__).resolve().parents[2] / "deploy" / "beat_healthcheck.py",
]
_MODULE_PATH = next((p for p in _CANDIDATES if p.exists()), None)
if _MODULE_PATH is None:
    raise RuntimeError(
        "beat_healthcheck.py not found in any of: "
        + ", ".join(str(p) for p in _CANDIDATES)
    )
_spec = importlib.util.spec_from_file_location("beat_healthcheck", _MODULE_PATH)
beat_healthcheck = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(beat_healthcheck)

verdict = beat_healthcheck.verdict

NOW = datetime(2026, 8, 15, 12, 0, tzinfo=timezone.utc)
TEN_MINUTES = 600  # pick-current-winner, the shortest built-in interval job


def test_a_fresh_install_is_healthy_before_any_job_has_run():
    """The regression that broke the documented first-deploy path.

    On a new database every seeded periodic_tasks row has last_run_at = NULL,
    and DatabaseScheduler deliberately treats a never-run job as "ran just now"
    to avoid a boot stampede — so nothing is written for a full interval. This
    used to return 1, which left the container in `health: starting` until
    `docker compose up --wait` timed out at 300s and `make deploy` died with
    "Stack did not come up healthy" on a stack that was, in fact, fine.
    """
    assert verdict(newest=None, shortest=TEN_MINUTES, now=NOW) == 0


def test_a_wedged_scheduler_is_still_caught():
    """The failure the probe actually exists for: beat up, but not scheduling."""
    stale = NOW - timedelta(seconds=TEN_MINUTES * 3 + 60)
    assert verdict(newest=stale, shortest=TEN_MINUTES, now=NOW) == 1


def test_a_recent_run_is_healthy():
    assert verdict(newest=NOW - timedelta(seconds=30), shortest=TEN_MINUTES, now=NOW) == 0


def test_a_run_just_inside_the_threshold_is_healthy():
    """Three times the shortest interval is the documented boundary."""
    edge = NOW - timedelta(seconds=TEN_MINUTES * 3 - 1)
    assert verdict(newest=edge, shortest=TEN_MINUTES, now=NOW) == 0


def test_cron_only_schedules_cannot_be_measured_for_staleness():
    """Cron jobs can legitimately be days apart, so there is no interval to
    compare against and the probe must not invent one."""
    assert verdict(newest=None, shortest=None, now=NOW) == 0
    assert verdict(newest=NOW - timedelta(days=6), shortest=None, now=NOW) == 0


def test_the_threshold_is_floored_so_a_fast_job_cannot_cause_false_alarms():
    """A 10s interval would otherwise give a 30s threshold — one slow tick and
    the container restarts itself in a loop."""
    assert verdict(newest=NOW - timedelta(minutes=4), shortest=10, now=NOW) == 0
    assert verdict(newest=NOW - timedelta(minutes=6), shortest=10, now=NOW) == 1


def test_the_threshold_is_capped_so_a_slow_job_cannot_mask_a_wedge():
    """A daily interval job would otherwise allow a 3-day silence."""
    assert verdict(newest=NOW - timedelta(hours=3), shortest=86400, now=NOW) == 1


@pytest.mark.parametrize("naive", [True, False])
def test_naive_timestamps_are_treated_as_utc(naive: bool):
    """Postgres can hand back a naive datetime depending on column type; reading
    that as local time would shift the age by the host's offset."""
    recent = NOW - timedelta(seconds=30)
    value = recent.replace(tzinfo=None) if naive else recent
    assert verdict(newest=value, shortest=TEN_MINUTES, now=NOW) == 0
