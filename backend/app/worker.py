from celery import Celery
from celery.schedules import crontab

from app.config import settings

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
    # every 10 minutes so a Top Dog becomes visible without waiting for
    # Monday's roll-over. Upserts the WeeklyWinner row for this week.
    "pick-current-winner": {
        "task": "app.tasks.weekly_winner.pick_current_winner_task",
        "schedule": 600.0,  # seconds
    },
}

celery_app.autodiscover_tasks(["app.tasks"])
