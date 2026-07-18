"""Admin CRUD for DB-backed Celery Beat jobs (the scheduled-job editor).

Rows live in the ``periodic_tasks`` table and are read live by
``app.beat_scheduler.DatabaseScheduler``, so edits here take effect within
``BEAT_MAX_INTERVAL`` with no redeploy. Mounted at the same ``/api/v1/admin``
prefix as the other admin routers; every route is admin-only and every mutation
is audit-logged.

The task field is constrained to the app's own registered ``app.tasks.*`` tasks
(the curated set the UI dropdown offers) — an admin can't schedule an arbitrary
dotted path.
"""
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_admin
from app.models.periodic_task import PeriodicTask
from app.models.user import User
from app.routers.admin import _log
from app.schemas.scheduled_task import (
    CRON_FIELDS,
    PeriodicTaskCreate,
    PeriodicTaskOut,
    PeriodicTaskUpdate,
    schedule_display,
    validate_schedule,
)

logger = structlog.get_logger()
router = APIRouter()


def _available_tasks() -> set[str]:
    """The app's own registered Celery tasks — the curated set the editor
    allows. Importing ``app.tasks`` forces each module's ``@task`` decorator to
    run so the names are present in ``celery_app.tasks`` (same trick as the
    system-jobs endpoint)."""
    import app.tasks  # noqa: F401 — force task modules to import & self-register
    from app.worker import celery_app

    return {name for name in celery_app.tasks if name.startswith("app.tasks.")}


def _serialize(row: PeriodicTask, available: set[str]) -> PeriodicTaskOut:
    out = PeriodicTaskOut.model_validate(row)
    out.registered = row.task in available
    out.schedule_display = schedule_display(
        row.schedule_type, row.interval_seconds,
        row.minute, row.hour, row.day_of_week, row.day_of_month, row.month_of_year,
    )
    return out


@router.get("/scheduled-tasks", response_model=list[PeriodicTaskOut])
async def list_scheduled_tasks(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    available = _available_tasks()
    rows = (await db.execute(
        select(PeriodicTask).order_by(PeriodicTask.name)
    )).scalars().all()
    return [_serialize(r, available) for r in rows]


@router.get("/scheduled-tasks/available-tasks", response_model=list[str])
async def list_available_tasks(admin: User = Depends(require_admin)):
    """Curated task names for the create/edit dropdown."""
    return sorted(_available_tasks())


@router.post("/scheduled-tasks", response_model=PeriodicTaskOut, status_code=201)
async def create_scheduled_task(
    body: PeriodicTaskCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    available = _available_tasks()
    if body.task not in available:
        raise HTTPException(status_code=422, detail=f"Unknown task '{body.task}'")

    row = PeriodicTask(
        name=body.name, task=body.task, schedule_type=body.schedule_type,
        interval_seconds=body.interval_seconds,
        minute=body.minute, hour=body.hour, day_of_week=body.day_of_week,
        day_of_month=body.day_of_month, month_of_year=body.month_of_year,
        args=body.args, kwargs=body.kwargs, queue=body.queue,
        enabled=body.enabled, one_off=body.one_off, description=body.description,
    )
    db.add(row)
    try:
        await db.flush()
        await _log(db, actor_id=admin.id, action="periodic_task.create",
                   target_type="periodic_task", target_id=row.id,
                   metadata={"name": row.name, "task": row.task})
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A job with that name already exists")
    await db.refresh(row)
    return _serialize(row, available)


async def _get_or_404(db: AsyncSession, task_id: UUID) -> PeriodicTask:
    row = (await db.execute(
        select(PeriodicTask).where(PeriodicTask.id == task_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Scheduled task not found")
    return row


@router.get("/scheduled-tasks/{task_id}", response_model=PeriodicTaskOut)
async def get_scheduled_task(
    task_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_or_404(db, task_id)
    return _serialize(row, _available_tasks())


@router.patch("/scheduled-tasks/{task_id}", response_model=PeriodicTaskOut)
async def update_scheduled_task(
    task_id: UUID,
    body: PeriodicTaskUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    available = _available_tasks()
    row = await _get_or_404(db, task_id)
    data = body.model_dump(exclude_unset=True)

    # Normalize/validate incoming fields.
    for field in ("name", "task"):
        if field in data and isinstance(data[field], str):
            data[field] = data[field].strip()
    for field in CRON_FIELDS:
        if field in data:
            data[field] = (data[field] or "").strip() or "*"
    if "task" in data and data["task"] not in available:
        raise HTTPException(status_code=422, detail=f"Unknown task '{data['task']}'")

    # Validate the schedule of the MERGED result (existing values + patch).
    merged = {f: data.get(f, getattr(row, f))
              for f in ("schedule_type", "interval_seconds", *CRON_FIELDS)}
    try:
        validate_schedule(**merged)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    for field, value in data.items():
        setattr(row, field, value)
    # Clear the unused side so the stored row stays unambiguous.
    if row.schedule_type == "interval":
        row.minute = row.hour = row.day_of_week = row.day_of_month = row.month_of_year = "*"
    else:
        row.interval_seconds = None

    try:
        await _log(db, actor_id=admin.id, action="periodic_task.update",
                   target_type="periodic_task", target_id=row.id,
                   metadata={"name": row.name, "fields": list(data.keys())})
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="A job with that name already exists")
    await db.refresh(row)
    return _serialize(row, available)


@router.delete("/scheduled-tasks/{task_id}", response_model=dict)
async def delete_scheduled_task(
    task_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_or_404(db, task_id)
    name = row.name
    await db.delete(row)
    await _log(db, actor_id=admin.id, action="periodic_task.delete",
               target_type="periodic_task", target_id=task_id, metadata={"name": name})
    await db.commit()
    return {"detail": "Scheduled task deleted"}


@router.post("/scheduled-tasks/{task_id}/run", response_model=dict)
async def run_scheduled_task_now(
    task_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Enqueue the task immediately (independent of its schedule)."""
    from app.worker import celery_app

    row = await _get_or_404(db, task_id)
    opts = {"queue": row.queue} if row.queue else {}
    try:
        result = celery_app.send_task(row.task, args=row.args or [], kwargs=row.kwargs or {}, **opts)
    except Exception as exc:  # noqa: BLE001 — broker down / routing error
        logger.warning("scheduled_task_run_failed", task=row.task, error=str(exc))
        raise HTTPException(status_code=502, detail="Could not enqueue the task (broker unavailable?)")

    await _log(db, actor_id=admin.id, action="periodic_task.run",
               target_type="periodic_task", target_id=row.id,
               metadata={"name": row.name, "task": row.task})
    await db.commit()
    return {"detail": "Task enqueued", "task_id": getattr(result, "id", None)}
