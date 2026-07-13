# Importing task modules here ensures their `@celery_app.task` decorators
# run at worker / beat startup, registering each task with the Celery app.
# `celery_app.autodiscover_tasks(["app.tasks"])` alone is NOT enough —
# by default it looks for an `app.tasks.tasks` submodule, not arbitrary
# files like `lost_alerts.py` / `weekly_winner.py`.
#
# Every task referenced by the beat schedule in `worker.py` MUST be imported
# here, or the worker rejects it as an "unregistered task" when beat dispatches
# it. token_cleanup was missing, so the daily refresh-token purge never ran.
from app.tasks import (  # noqa: F401
    announcements,
    digest,
    lost_alerts,
    token_cleanup,
    weekly_winner,
)
