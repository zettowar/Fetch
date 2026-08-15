import logging
import os

from celery import Celery
from celery.signals import celeryd_init, worker_process_init

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


# --- Metrics ---------------------------------------------------------------
# Every bulk email (digest, announcements, weekly recap) is sent from here, not
# from the web process, so those counters lived in a process nothing scraped —
# the EmailDeliveryFailing alert could never fire for the flows it exists for.
# Serve them on a port of our own for Prometheus to scrape as a second target.
#
# Prefork spawns child processes, so the numbers are spread across them the
# same way they are across uvicorn's workers; PROMETHEUS_MULTIPROC_DIR (set in
# the compose file) makes the exporter below aggregate the lot.

METRICS_PORT = int(settings.CELERY_METRICS_PORT or 0)


@worker_process_init.connect
def _reset_child_metrics(**_kwargs):
    """A forked child inherits the parent's mmap handles; re-registering keeps
    each child writing to its own file rather than corrupting a shared one."""
    from prometheus_client import values

    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        values.ValueClass = values.MultiProcessValue()


@celeryd_init.connect
def _start_metrics_server(**_kwargs):
    if not METRICS_PORT:
        return
    try:
        from prometheus_client import start_http_server

        # Import the sender so its Counter is registered at startup. The tasks
        # import it lazily inside their function bodies, so without this the
        # family only appears after the first email is attempted — and a target
        # exposing no series looks exactly like a healthy one.
        import app.services.email  # noqa: F401
        from app.metrics import build_registry

        start_http_server(METRICS_PORT, registry=build_registry())
    except Exception:  # noqa: BLE001 — monitoring must never stop the worker
        logging.getLogger(__name__).warning(
            "celery_metrics_server_failed", exc_info=True
        )
