"""A database-backed Celery Beat scheduler — the runtime half of the scheduled-job
editor. It reads ``periodic_tasks`` rows (instead of a static
``conf.beat_schedule``) and reloads when they change, so admins can add,
reschedule, enable/disable, or delete jobs from the admin panel and Beat picks
the change up within ``BEAT_MAX_INTERVAL`` — no redeploy. This mirrors
django-celery-beat's ``DatabaseScheduler`` with a single-table model.

Only the ``celery beat`` process imports this module (it's wired via the string
``celery_app.conf.beat_scheduler``), so the synchronous psycopg2 engine below is
never constructed in the web app or the worker, which stay on async asyncpg.

Change detection uses ``(count(*), max(updated_at))`` of the table. Beat's own
run-count/last-run write-backs go through raw SQL that deliberately does NOT
touch ``updated_at``, so they never look like a config edit — that's what keeps
high-frequency write-backs from triggering a reload loop. Everything is UTC.
"""
from datetime import timedelta

import structlog
from celery.beat import ScheduleEntry, Scheduler
from celery.schedules import crontab, schedule
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.periodic_task import PeriodicTask

logger = structlog.get_logger()


def build_schedule(row, app=None):
    """Pure row → celery schedule mapping (kept module-level so it's unit-testable
    without a DB or a running Beat). ``row`` is anything with the periodic-task
    attributes (an ORM instance or a stub)."""
    if row.schedule_type == "interval":
        return schedule(run_every=timedelta(seconds=float(row.interval_seconds or 0)), app=app)
    return crontab(
        minute=row.minute, hour=row.hour, day_of_week=row.day_of_week,
        day_of_month=row.day_of_month, month_of_year=row.month_of_year, app=app,
    )


class ModelEntry(ScheduleEntry):
    """One ``periodic_tasks`` row as a Beat schedule entry. Scalar values are
    copied out of the row at construction so the entry never touches a
    (possibly detached) ORM object afterwards."""

    def __init__(self, row, app):
        self.app = app
        self.name = row.name
        self.task = row.task
        self.model_id = row.id
        self.one_off = row.one_off
        self.args = row.args or []
        self.kwargs = row.kwargs or {}
        self.options = {"queue": row.queue} if row.queue else {}
        self.schedule = build_schedule(row, app)
        self.total_run_count = row.total_run_count or 0
        # Never-run tasks start "as if run now" so they don't all stampede-fire
        # the instant Beat boots (django-celery-beat's default_now behavior).
        self.last_run_at = row.last_run_at or app.now()

    def is_due(self):
        return self.schedule.is_due(self.last_run_at)

    def __next__(self):
        # Build the advanced entry by cloning __dict__ (ScheduleEntry.__reduce__
        # rebuilds via the base 8-arg __init__, which our (row, app) signature
        # doesn't match, so copy.copy / super().__next__ can't be used here).
        entry = self.__class__.__new__(self.__class__)
        entry.__dict__.update(self.__dict__)
        entry.last_run_at = self.app.now()
        entry.total_run_count = self.total_run_count + 1
        return entry

    next = __next__  # celery calls next(entry)


class DatabaseScheduler(Scheduler):
    Entry = ModelEntry
    # Persist run-count/last-run write-backs at most once a minute.
    sync_every = 60

    def __init__(self, *args, **kwargs):
        self._engine = None
        self._Session = None
        self._dirty: set[str] = set()
        self._last_marker = None
        self._loaded_once = False
        super().__init__(*args, **kwargs)
        # How long Beat may sleep between ticks — also caps how long an edit
        # waits before it's noticed.
        self.max_interval = float(settings.BEAT_MAX_INTERVAL)

    # --- sync engine (lazy; beat-process only) ---------------------------------

    def _session(self):
        if self._Session is None:
            self._engine = create_engine(
                settings.SYNC_DATABASE_URL, pool_pre_ping=True, pool_recycle=1800, future=True,
            )
            self._Session = sessionmaker(self._engine)
        return self._Session()

    # --- schedule loading + change detection -----------------------------------

    def setup_schedule(self):
        # Nothing to install from conf.beat_schedule (it's empty) and we don't
        # want celery's built-in default entries — the editor is the complete
        # source of truth. The schedule loads lazily on first access.
        pass

    def _marker(self, session):
        return session.execute(
            select(func.count(PeriodicTask.id), func.max(PeriodicTask.updated_at))
        ).one()

    def all_as_schedule(self, session):
        rows = session.execute(
            select(PeriodicTask).where(PeriodicTask.enabled.is_(True))
        ).scalars().all()
        return {row.name: ModelEntry(row, self.app) for row in rows}

    def _reload(self):
        # Persist any pending run-count bumps first so the rebuilt entries carry
        # fresh totals; then rebuild the marker + schedule in one session.
        self.sync()
        try:
            with self._session() as session:
                self._last_marker = self._marker(session)
                self.data = self.all_as_schedule(session)
            self._loaded_once = True
        except Exception as exc:  # noqa: BLE001 — DB down: keep last-known, retry next tick
            logger.warning("beat_schedule_reload_failed", error=str(exc))
            if self.data is None:
                self.data = {}

    def _schedule_changed(self):
        try:
            with self._session() as session:
                return self._marker(session) != self._last_marker
        except Exception as exc:  # noqa: BLE001 — transient DB error: don't churn
            logger.warning("beat_schedule_check_failed", error=str(exc))
            return False

    @property
    def schedule(self):
        if not self._loaded_once or self._schedule_changed():
            self._reload()
        return self.data

    @schedule.setter
    def schedule(self, value):
        self.data = value

    # --- run-count write-back --------------------------------------------------

    def reserve(self, entry):
        new_entry = super().reserve(entry)  # advances the entry in self.data
        self._dirty.add(new_entry.name)
        return new_entry

    def sync(self):
        if not self._dirty:
            return
        names = list(self._dirty)
        self._dirty.clear()
        # Snapshot the entries to persist (name → live entry with bumped stats).
        pending = [(self.data.get(n)) for n in names]
        pending = [e for e in pending if e is not None]
        if not pending:
            return
        try:
            with self._session() as session:
                for entry in pending:
                    params = {
                        "lr": entry.last_run_at,
                        "c": entry.total_run_count,
                        "id": str(entry.model_id),
                    }
                    # Raw SQL on purpose: it must NOT bump updated_at, or the
                    # change-marker would treat our own write-back as a config
                    # edit and reload every run.
                    if entry.one_off:
                        session.execute(text(
                            "UPDATE periodic_tasks SET last_run_at=:lr, total_run_count=:c, "
                            "enabled=false WHERE id=CAST(:id AS uuid)"
                        ), params)
                    else:
                        session.execute(text(
                            "UPDATE periodic_tasks SET last_run_at=:lr, total_run_count=:c "
                            "WHERE id=CAST(:id AS uuid)"
                        ), params)
                session.commit()
        except Exception as exc:  # noqa: BLE001 — retry these on the next sync
            logger.warning("beat_sync_failed", error=str(exc))
            self._dirty.update(names)

    def close(self):
        self.sync()
        if self._engine is not None:
            self._engine.dispose()
        super().close()
