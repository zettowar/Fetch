from datetime import datetime

from sqlalchemy import Boolean, Float, Integer, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey


class PeriodicTask(Base, UUIDPrimaryKey, TimestampMixin):
    """A DB-backed Celery Beat entry — the editable equivalent of a row in
    ``celery_app.conf.beat_schedule``. ``app.beat_scheduler.DatabaseScheduler``
    reads these rows (single-table design, unlike django-celery-beat's split
    crontab/interval tables) and reloads when they change, so admins can add,
    reschedule, enable/disable, or delete jobs without a redeploy.

    Exactly one schedule kind is populated per row, keyed by ``schedule_type``:
    ``interval`` uses ``interval_seconds``; ``crontab`` uses the five cron fields.
    ``last_run_at`` / ``total_run_count`` are written back by the scheduler.
    All times are UTC (Celery runs with ``enable_utc=True``)."""

    __tablename__ = "periodic_tasks"

    # Human-facing unique label, e.g. "compute-weekly-winner".
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    # Dotted Celery task path, e.g. "app.tasks.weekly_winner.compute_weekly_winner_task".
    task: Mapped[str] = mapped_column(String(255), nullable=False)

    # "interval" | "crontab" — which of the fields below is authoritative.
    schedule_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # interval schedules
    interval_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # crontab schedules — cron-style strings, "*" meaning "every".
    minute: Mapped[str] = mapped_column(String(64), nullable=False, default="*", server_default="*")
    hour: Mapped[str] = mapped_column(String(64), nullable=False, default="*", server_default="*")
    day_of_week: Mapped[str] = mapped_column(String(64), nullable=False, default="*", server_default="*")
    day_of_month: Mapped[str] = mapped_column(String(64), nullable=False, default="*", server_default="*")
    month_of_year: Mapped[str] = mapped_column(String(64), nullable=False, default="*", server_default="*")

    # Positional args / keyword args passed to the task when dispatched.
    args: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    kwargs: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")

    # Optional Celery queue override.
    queue: Mapped[str | None] = mapped_column(String(128), nullable=True)

    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # Run once, then auto-disable (the scheduler flips ``enabled`` off after firing).
    one_off: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_run_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
