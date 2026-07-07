from celery import Celery
from celery.schedules import crontab

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

celery_app.conf.beat_schedule = {
    "compute-weekly-winner": {
        "task": "app.tasks.weekly_winner.compute_weekly_winner_task",
        "schedule": crontab(day_of_week="monday", hour=0, minute=5),
    },
    # Troubleshooting / dev: pick a winner from the current week's votes
    # every 10 minutes so a Top Pet becomes visible without waiting for
    # Monday's roll-over. Upserts the WeeklyWinner row for this week.
    "pick-current-winner": {
        "task": "app.tasks.weekly_winner.pick_current_winner_task",
        "schedule": 600.0,  # seconds
    },
    "purge-refresh-tokens": {
        "task": "app.tasks.token_cleanup.purge_refresh_tokens_task",
        "schedule": crontab(hour=3, minute=0),
    },
}

celery_app.autodiscover_tasks(["app.tasks"])
