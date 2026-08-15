"""Expose Celery Beat's liveness as a Prometheus gauge.

The compose healthcheck (deploy/beat_healthcheck.py) marks the beat *container*
unhealthy when the scheduler wedges, but nothing watches container health, so
nobody finds out. Beat has no HTTP server of its own to scrape, so the backend
publishes the same signal on its /metrics endpoint where Prometheus can alert
on it.

Refreshed by a background task rather than computed during the scrape: a
synchronous DB query inside the /metrics handler would block the event loop,
and a scrape must never be able to stall the API.
"""
import asyncio

import structlog
from prometheus_client import Gauge
from sqlalchemy import text

logger = structlog.stdlib.get_logger()

REFRESH_SECONDS = 60

# -1 means "unknown" (never refreshed, or the query failed) so an alert can
# distinguish that from a genuinely stale scheduler.
# Every uvicorn worker refreshes this independently, so without a mode the
# multiprocess collector emits one series per PID.
#
# "livemax", not "max": nothing reaps the mmap file of a worker that died, so
# plain "max" would pin the highest reading that process ever wrote — forever.
# A worker crashing while the scheduler happened to be stale would latch
# BeatScheduleStalled on with no way to resolve short of a restart, which is
# the failure mode an alert must never have. "livemax" only considers
# processes that are still alive.
BEAT_LAST_RUN_AGE = Gauge(
    "fetchpawz_beat_last_run_age_seconds",
    "Seconds since Celery Beat last fired any enabled periodic task (-1 = unknown).",
    multiprocess_mode="livemax",
)
BEAT_SHORTEST_INTERVAL = Gauge(
    "fetchpawz_beat_shortest_interval_seconds",
    "Shortest enabled interval schedule, so alert rules can scale to the "
    "admin-edited schedule instead of hard-coding a threshold (-1 = none).",
    multiprocess_mode="livemax",
)

BEAT_LAST_RUN_AGE.set(-1)
BEAT_SHORTEST_INTERVAL.set(-1)

_QUERY = text(
    """
    SELECT
      EXTRACT(EPOCH FROM (now() - MAX(last_run_at))) AS age,
      MIN(interval_seconds) FILTER (
        WHERE schedule_type = 'interval' AND interval_seconds > 0
      ) AS shortest
    FROM periodic_tasks
    WHERE enabled
    """
)


async def refresh_once(session_factory) -> None:
    async with session_factory() as db:
        row = (await db.execute(_QUERY)).one()
    BEAT_LAST_RUN_AGE.set(float(row.age) if row.age is not None else -1)
    BEAT_SHORTEST_INTERVAL.set(float(row.shortest) if row.shortest is not None else -1)


async def run_forever(session_factory) -> None:
    """Background refresh loop. Never raises out — a monitoring failure must
    not take the API down with it."""
    while True:
        try:
            await refresh_once(session_factory)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("beat_monitor_refresh_failed", error=str(exc))
            BEAT_LAST_RUN_AGE.set(-1)
        await asyncio.sleep(REFRESH_SECONDS)
