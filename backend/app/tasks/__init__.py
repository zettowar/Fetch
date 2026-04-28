# Importing task modules here ensures their `@celery_app.task` decorators
# run at worker / beat startup, registering each task with the Celery app.
# `celery_app.autodiscover_tasks(["app.tasks"])` alone is NOT enough —
# by default it looks for an `app.tasks.tasks` submodule, not arbitrary
# files like `lost_alerts.py` / `weekly_winner.py`.
from app.tasks import lost_alerts, weekly_winner  # noqa: F401
