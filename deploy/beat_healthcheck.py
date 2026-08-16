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


def verdict(newest, shortest, now=None) -> int:
    """The healthcheck decision, separated from the database so it can be tested.

    ``newest``   = MAX(last_run_at) across enabled jobs, or None if none has run
    ``shortest`` = MIN(interval_seconds) among enabled interval jobs, or None
    """
    now = now or datetime.now(timezone.utc)

    if shortest is None:
        # Only cron jobs are enabled (they can legitimately be days apart), so
        # there is no interval to measure staleness against. Beat being up is
        # all we can assert here.
        print("beat-health: no enabled interval jobs; process-liveness only")
        return 0

    threshold = timedelta(seconds=float(shortest) * 3)
    threshold = max(MIN_THRESHOLD, min(threshold, MAX_THRESHOLD))

    if newest is None:
        # No job has EVER run. This is the normal state of a fresh install for
        # up to one full interval, and it is not distinguishable from a wedged
        # scheduler using database state alone — DatabaseScheduler starts a
        # never-run task as if it had just run (`row.last_run_at or app.now()`,
        # deliberately, to avoid a boot stampede), so nothing is written to
        # last_run_at until the first real fire ~600s after beat boots.
        #
        # An earlier version returned 1 here, on the assumption that compose's
        # `start_period` covered the boot case. It does not: start_period only
        # stops early failures counting toward `retries`, leaving the container
        # in `health: starting` — and `docker compose up --wait` (which
        # deploy/deploy.sh relies on) treats "still starting" as failure once its
        # timeout expires. The result was that the very first `make deploy`
        # against a new database always died at the 300s wait with "Stack did not
        # come up healthy", pointing the operator at a problem that did not
        # exist, and skipping the public-edge smoke test on the one deploy where
        # it matters most.
        #
        # So: healthy. Staleness below is what actually catches a wedged
        # scheduler, and it needs a baseline before it can say anything. The
        # permanently-never-fires case is covered by the BeatScheduleStalled
        # Prometheus alert and the per-job status on Admin → System.
        print("beat-health: no job has run yet (fresh install) — nothing stale to report")
        return 0

    if newest.tzinfo is None:
        newest = newest.replace(tzinfo=timezone.utc)
    age = now - newest

    if age > threshold:
        print(
            f"beat-health: last run {age.total_seconds():.0f}s ago exceeds "
            f"{threshold.total_seconds():.0f}s — scheduler looks wedged",
            file=sys.stderr,
        )
        return 1

    print(f"beat-health: ok (last run {age.total_seconds():.0f}s ago)")
    return 0


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

    return verdict(row.newest, row.shortest)





if __name__ == "__main__":
    sys.exit(main())
