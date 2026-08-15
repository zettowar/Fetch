"""Canonical definitions of the built-in periodic jobs.

These used to live inline in ``celery_app.conf.beat_schedule`` (worker.py). Now
that Beat reads its schedule from the ``periodic_tasks`` table
(``app.beat_scheduler.DatabaseScheduler``), this module is the single source of
truth for the defaults: the Alembic migration that creates the table seeds these
rows, so a fresh install behaves exactly as before while remaining editable.

Each dict maps 1:1 onto ``PeriodicTask`` columns. Crontab jobs leave
``interval_seconds`` unset (None) and populate the cron fields; interval jobs do
the reverse. Cron fields default to "*". Times are UTC.
"""

# Sensible per-field defaults so callers (seed migration) can fill the rest.
_CRON_DEFAULTS = {
    "minute": "*",
    "hour": "*",
    "day_of_week": "*",
    "day_of_month": "*",
    "month_of_year": "*",
    "interval_seconds": None,
    "args": [],
    "kwargs": {},
    "queue": None,
    "enabled": True,
    "one_off": False,
}


def _job(**overrides) -> dict:
    return {**_CRON_DEFAULTS, **overrides}


DEFAULT_PERIODIC_TASKS: list[dict] = [
    _job(
        name="compute-weekly-winner",
        task="app.tasks.weekly_winner.compute_weekly_winner_task",
        schedule_type="crontab",
        minute="5",
        hour="0",
        day_of_week="monday",
        description="Crown the weekly Top Pet at the Monday roll-over (00:05 UTC).",
    ),
    _job(
        name="pick-current-winner",
        task="app.tasks.weekly_winner.pick_current_winner_task",
        schedule_type="interval",
        interval_seconds=600.0,
        description="Upsert this week's winner from current votes every 10 minutes.",
    ),
    _job(
        name="weekly-recap",
        task="app.tasks.weekly_recap.send_weekly_recap_task",
        schedule_type="crontab",
        minute="20",
        hour="0",
        day_of_week="monday",
        description=(
            "Email each owner how their pets did last week (00:20 UTC Monday, "
            "after the crown is computed). No-ops unless the "
            "weekly_recap_enabled setting is on."
        ),
    ),
    _job(
        name="purge-refresh-tokens",
        task="app.tasks.token_cleanup.purge_refresh_tokens_task",
        schedule_type="crontab",
        minute="0",
        hour="3",
        description="Delete expired/used refresh tokens daily (03:00 UTC).",
    ),
    _job(
        name="send-notification-digest",
        task="app.tasks.digest.send_digest_task",
        schedule_type="crontab",
        minute="0",
        hour="13",
        description="Send daily (and Monday weekly) notification digests (13:00 UTC).",
    ),
]
