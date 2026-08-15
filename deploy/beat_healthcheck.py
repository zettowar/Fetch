"""Liveness probe for the Celery Beat container.

`docker` already restarts beat if the process exits. The failure this catches is
the one that costs you silently: beat still running but no longer scheduling, so
the weekly crown, the digest and token cleanup all stop with nothing in the logs
and no container restart.

Beat's DatabaseScheduler stamps `periodic_tasks.last_run_at` every time it fires
a job, so a stale maximum across the enabled jobs means the scheduler is wedged.

The threshold is derived from the schedule rather than hard-coded: three times
the shortest enabled interval, floored at 5 minutes and capped at 2 hours, so
editing a job in Admin → System can't turn the healthcheck into a false alarm.

Exit 0 = healthy, 1 = wedged (or the DB is unreachable, which beat cannot work
without anyway).
"""
import sys
from datetime import datetime, timedelta, timezone

MIN_THRESHOLD = timedelta(minutes=5)
MAX_THRESHOLD = timedelta(hours=2)


def main() -> int:
    try:
        from sqlalchemy import create_engine, text
        from app.config import settings
    except Exception as exc:  # noqa: BLE001
        print(f"beat-health: cannot import app ({exc})", file=sys.stderr)
        return 1

    try:
        engine = create_engine(settings.SYNC_DATABASE_URL, pool_pre_ping=True)
        with engine.connect() as conn:
            row = conn.execute(text(
                """
                SELECT
                  MAX(last_run_at) AS newest,
                  MIN(interval_seconds) FILTER (
                    WHERE schedule_type = 'interval' AND interval_seconds > 0
                  ) AS shortest
                FROM periodic_tasks
                WHERE enabled
                """
            )).one()
    except Exception as exc:  # noqa: BLE001
        print(f"beat-health: database unreachable ({exc})", file=sys.stderr)
        return 1
    finally:
        try:
            engine.dispose()
        except Exception:  # noqa: BLE001
            pass

    newest, shortest = row.newest, row.shortest

    if shortest is None:
        # Only cron jobs are enabled (they can legitimately be days apart), so
        # there is no interval to measure staleness against. Beat being up is
        # all we can assert here.
        print("beat-health: no enabled interval jobs; process-liveness only")
        return 0

    threshold = timedelta(seconds=float(shortest) * 3)
    threshold = max(MIN_THRESHOLD, min(threshold, MAX_THRESHOLD))

    if newest is None:
        # Fresh install, or beat has genuinely never fired. `start_period` in
        # the compose healthcheck covers the boot case; past that this is real.
        print("beat-health: no job has ever run", file=sys.stderr)
        return 1

    if newest.tzinfo is None:
        newest = newest.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - newest

    if age > threshold:
        print(
            f"beat-health: last run {age.total_seconds():.0f}s ago exceeds "
            f"{threshold.total_seconds():.0f}s — scheduler looks wedged",
            file=sys.stderr,
        )
        return 1

    print(f"beat-health: ok (last run {age.total_seconds():.0f}s ago)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
