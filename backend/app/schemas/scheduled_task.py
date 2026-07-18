"""Schemas + shared schedule helpers for the DB-backed periodic-task editor.

Crontab fields are validated by constructing a real ``celery.schedules.crontab``
so the API accepts exactly what Beat will run (no hand-rolled regex). Times are
UTC (Celery runs with ``enable_utc=True``)."""
from datetime import datetime
from uuid import UUID

from celery.schedules import crontab
from pydantic import BaseModel, Field, field_validator, model_validator

SCHEDULE_TYPES = ("interval", "crontab")
CRON_FIELDS = ("minute", "hour", "day_of_week", "day_of_month", "month_of_year")


def build_crontab(minute: str, hour: str, day_of_week: str, day_of_month: str, month_of_year: str) -> crontab:
    """Construct a celery crontab from the five cron strings (raises ValueError
    on a bad spec, which callers turn into a 422)."""
    return crontab(
        minute=minute, hour=hour, day_of_week=day_of_week,
        day_of_month=day_of_month, month_of_year=month_of_year,
    )


def validate_schedule(
    schedule_type: str,
    interval_seconds: float | None,
    minute: str, hour: str, day_of_week: str, day_of_month: str, month_of_year: str,
) -> None:
    """Raise ValueError if the schedule is incoherent. Shared by the create
    schema and the PATCH handler (which validates the merged result)."""
    if schedule_type not in SCHEDULE_TYPES:
        raise ValueError(f"schedule_type must be one of {SCHEDULE_TYPES}")
    if schedule_type == "interval":
        if interval_seconds is None or interval_seconds <= 0:
            raise ValueError("interval_seconds must be greater than 0 for an interval schedule")
    else:  # crontab
        try:
            build_crontab(minute, hour, day_of_week, day_of_month, month_of_year)
        except (ValueError, KeyError) as exc:
            raise ValueError(f"Invalid crontab schedule: {exc}")


def _humanize_interval(seconds: float) -> str:
    total = int(round(seconds))
    parts = []
    for label, size in (("d", 86400), ("h", 3600), ("m", 60), ("s", 1)):
        if total >= size:
            parts.append(f"{total // size}{label}")
            total %= size
    return "every " + " ".join(parts) if parts else "every 0s"


def schedule_display(
    schedule_type: str,
    interval_seconds: float | None,
    minute: str, hour: str, day_of_week: str, day_of_month: str, month_of_year: str,
) -> str:
    """A short human-readable schedule string for the admin UI."""
    if schedule_type == "interval":
        return _humanize_interval(interval_seconds or 0)
    # crontab — show in `m h dom mon dow` order (standard cron column order), UTC.
    return f"cron: {minute} {hour} {day_of_month} {month_of_year} {day_of_week} (UTC)"


class PeriodicTaskCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    task: str = Field(..., min_length=1, max_length=255)
    schedule_type: str
    interval_seconds: float | None = None
    minute: str = "*"
    hour: str = "*"
    day_of_week: str = "*"
    day_of_month: str = "*"
    month_of_year: str = "*"
    args: list = Field(default_factory=list)
    kwargs: dict = Field(default_factory=dict)
    queue: str | None = Field(default=None, max_length=128)
    enabled: bool = True
    one_off: bool = False
    description: str | None = Field(default=None, max_length=500)

    @field_validator("name", "task")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Required")
        return v

    @field_validator(*CRON_FIELDS)
    @classmethod
    def _default_cron_field(cls, v: str) -> str:
        # Empty string means "every" — normalize to "*" so crontab() accepts it.
        return (v or "").strip() or "*"

    @model_validator(mode="after")
    def _validate_and_normalize(self) -> "PeriodicTaskCreate":
        validate_schedule(
            self.schedule_type, self.interval_seconds,
            self.minute, self.hour, self.day_of_week, self.day_of_month, self.month_of_year,
        )
        # Clear the unused side so stored rows are unambiguous.
        if self.schedule_type == "interval":
            self.minute = self.hour = self.day_of_week = self.day_of_month = self.month_of_year = "*"
        else:
            self.interval_seconds = None
        return self


class PeriodicTaskUpdate(BaseModel):
    """All-optional PATCH. Schedule coherence is re-validated in the handler
    against the merged (existing + patch) values."""
    name: str | None = Field(default=None, min_length=1, max_length=200)
    task: str | None = Field(default=None, min_length=1, max_length=255)
    schedule_type: str | None = None
    interval_seconds: float | None = None
    minute: str | None = None
    hour: str | None = None
    day_of_week: str | None = None
    day_of_month: str | None = None
    month_of_year: str | None = None
    args: list | None = None
    kwargs: dict | None = None
    queue: str | None = Field(default=None, max_length=128)
    enabled: bool | None = None
    one_off: bool | None = None
    description: str | None = Field(default=None, max_length=500)


class PeriodicTaskOut(BaseModel):
    id: UUID
    name: str
    task: str
    schedule_type: str
    interval_seconds: float | None = None
    minute: str
    hour: str
    day_of_week: str
    day_of_month: str
    month_of_year: str
    args: list
    kwargs: dict
    queue: str | None = None
    enabled: bool
    one_off: bool
    last_run_at: datetime | None = None
    total_run_count: int
    description: str | None = None
    created_at: datetime
    updated_at: datetime
    # Computed (set by the router), not columns:
    registered: bool = False
    schedule_display: str = ""

    model_config = {"from_attributes": True}
