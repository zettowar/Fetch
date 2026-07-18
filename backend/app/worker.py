from celery import Celery

from app.config import settings

# Report background-job errors to Sentry too (the FastAPI app inits its own).
# No-op if DSN isn't set.
if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        integrations=[CeleryIntegration()],
    )

celery_app = Celery(
    "fetch",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# The beat schedule is no longer defined here. Beat reads it from the
# `periodic_tasks` table via `app.beat_scheduler.DatabaseScheduler` (wired with
# `celery ... beat --scheduler app.beat_scheduler:DatabaseScheduler` in the
# compose files), so admins can edit jobs live from the admin panel with no
# redeploy. The built-in jobs live in `app.tasks.schedule_defaults` and are
# seeded into the table by an Alembic migration. Leaving this empty guarantees
# no double-scheduling even if the default scheduler is ever used by accident.
celery_app.conf.beat_schedule = {}

# Beat reads its schedule from the DB via this scheduler (string form so only the
# beat process imports it — the sync psycopg2 engine never loads in the web/worker
# processes). `celery -A app.worker beat` honors this with no --scheduler flag.
celery_app.conf.beat_scheduler = "app.beat_scheduler:DatabaseScheduler"

celery_app.autodiscover_tasks(["app.tasks"])
