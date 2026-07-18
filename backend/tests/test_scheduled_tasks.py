"""Tests for the scheduled-job editor: the CRUD API, its validation, and the
row → celery-schedule mapping in the DB-backed Beat scheduler (exercised without
a live Beat process or the sync psycopg2 engine)."""
import uuid
from datetime import timedelta
from types import SimpleNamespace

import pytest
from httpx import AsyncClient

BASE = "/api/v1/admin/scheduled-tasks"

# Tasks that actually exist in the app (curated set the editor allows).
INTERVAL_TASK = "app.tasks.token_cleanup.purge_refresh_tokens_task"
CRONTAB_TASK = "app.tasks.digest.send_digest_task"


def _interval_payload(**over):
    p = {
        "name": f"job-{uuid.uuid4().hex[:8]}",
        "task": INTERVAL_TASK,
        "schedule_type": "interval",
        "interval_seconds": 120,
    }
    p.update(over)
    return p


def _crontab_payload(**over):
    p = {
        "name": f"job-{uuid.uuid4().hex[:8]}",
        "task": CRONTAB_TASK,
        "schedule_type": "crontab",
        "minute": "0",
        "hour": "3",
    }
    p.update(over)
    return p


# --- CRUD ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crud_roundtrip(client: AsyncClient, admin_headers: dict):
    # create (interval)
    res = await client.post(BASE, json=_interval_payload(name="iv-1"), headers=admin_headers)
    assert res.status_code == 201, res.text
    job = res.json()
    assert job["schedule_type"] == "interval"
    assert job["interval_seconds"] == 120
    assert job["registered"] is True
    assert job["schedule_display"]
    jid = job["id"]

    # list includes it
    res = await client.get(BASE, headers=admin_headers)
    assert res.status_code == 200
    assert any(j["id"] == jid for j in res.json())

    # get one
    res = await client.get(f"{BASE}/{jid}", headers=admin_headers)
    assert res.status_code == 200

    # patch: disable + convert to crontab (interval_seconds must be cleared)
    res = await client.patch(
        f"{BASE}/{jid}",
        json={"enabled": False, "schedule_type": "crontab", "minute": "5", "hour": "1"},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    job = res.json()
    assert job["enabled"] is False
    assert job["schedule_type"] == "crontab"
    assert job["interval_seconds"] is None
    assert job["minute"] == "5" and job["hour"] == "1"

    # delete
    res = await client.delete(f"{BASE}/{jid}", headers=admin_headers)
    assert res.status_code == 200
    res = await client.get(f"{BASE}/{jid}", headers=admin_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_available_tasks(client: AsyncClient, admin_headers: dict):
    res = await client.get(f"{BASE}/available-tasks", headers=admin_headers)
    assert res.status_code == 200
    tasks = res.json()
    assert CRONTAB_TASK in tasks
    assert all(t.startswith("app.tasks.") for t in tasks)


# --- Auth ------------------------------------------------------------------

@pytest.mark.asyncio
async def test_non_admin_forbidden(client: AsyncClient, auth_headers: dict):
    res = await client.get(BASE, headers=auth_headers)
    assert res.status_code == 403
    res = await client.post(BASE, json=_interval_payload(), headers=auth_headers)
    assert res.status_code == 403


# --- Validation ------------------------------------------------------------

@pytest.mark.asyncio
async def test_unknown_task_rejected(client: AsyncClient, admin_headers: dict):
    res = await client.post(
        BASE, json=_interval_payload(task="app.tasks.does_not_exist"), headers=admin_headers
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_nonpositive_interval_rejected(client: AsyncClient, admin_headers: dict):
    res = await client.post(BASE, json=_interval_payload(interval_seconds=0), headers=admin_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_bad_crontab_rejected(client: AsyncClient, admin_headers: dict):
    res = await client.post(BASE, json=_crontab_payload(minute="99"), headers=admin_headers)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_name_conflict(client: AsyncClient, admin_headers: dict):
    name = f"dup-{uuid.uuid4().hex[:8]}"
    res = await client.post(BASE, json=_interval_payload(name=name), headers=admin_headers)
    assert res.status_code == 201
    res = await client.post(BASE, json=_interval_payload(name=name), headers=admin_headers)
    assert res.status_code == 409


# --- Run now ---------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_now_enqueues(client: AsyncClient, admin_headers: dict, monkeypatch):
    from app.worker import celery_app

    calls = {}

    def fake_send_task(name, args=None, kwargs=None, **opts):
        calls.update(name=name, args=args, kwargs=kwargs, opts=opts)
        return SimpleNamespace(id="fake-task-id")

    monkeypatch.setattr(celery_app, "send_task", fake_send_task)

    res = await client.post(BASE, json=_interval_payload(name="run-me"), headers=admin_headers)
    jid = res.json()["id"]
    res = await client.post(f"{BASE}/{jid}/run", headers=admin_headers)
    assert res.status_code == 200, res.text
    assert res.json()["task_id"] == "fake-task-id"
    assert calls["name"] == INTERVAL_TASK


@pytest.mark.asyncio
async def test_run_missing_404(client: AsyncClient, admin_headers: dict):
    res = await client.post(f"{BASE}/{uuid.uuid4()}/run", headers=admin_headers)
    assert res.status_code == 404


# --- Scheduler mapping (no DB / no live Beat) ------------------------------

def _row(**over):
    base = dict(
        id=uuid.uuid4(), name="x", task="app.tasks.y", one_off=False,
        args=[], kwargs={}, queue=None, schedule_type="interval", interval_seconds=600,
        minute="*", hour="*", day_of_week="*", day_of_month="*", month_of_year="*",
        total_run_count=0, last_run_at=None,
    )
    base.update(over)
    return SimpleNamespace(**base)


def test_build_schedule_interval():
    from celery.schedules import schedule

    from app.beat_scheduler import build_schedule

    s = build_schedule(_row(schedule_type="interval", interval_seconds=600))
    assert isinstance(s, schedule)
    assert s.run_every == timedelta(seconds=600)


def test_build_schedule_crontab():
    from celery.schedules import crontab

    from app.beat_scheduler import build_schedule

    c = build_schedule(_row(schedule_type="crontab", interval_seconds=None,
                            minute="5", hour="0", day_of_week="mon"))
    assert isinstance(c, crontab)
    assert c.minute == {5}
    assert c.hour == {0}
    assert c.day_of_week == {1}


def test_model_entry_maps_dispatch_fields_and_seeds_last_run():
    from app.beat_scheduler import ModelEntry
    from app.worker import celery_app

    row = _row(one_off=True, args=[1], kwargs={"a": 2}, queue="q1", total_run_count=4)
    entry = ModelEntry(row, celery_app)
    assert entry.name == "x"
    assert entry.task == "app.tasks.y"
    assert entry.args == [1]
    assert entry.kwargs == {"a": 2}
    assert entry.options == {"queue": "q1"}
    assert entry.one_off is True
    # never-run task is seeded to "now" so it doesn't stampede-fire at boot
    assert entry.last_run_at is not None

    advanced = next(entry)
    assert advanced.total_run_count == 5
    assert advanced.name == "x"
    assert advanced.model_id == row.id
