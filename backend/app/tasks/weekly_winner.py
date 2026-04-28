import asyncio

from app.worker import celery_app


@celery_app.task(name="app.tasks.weekly_winner.compute_weekly_winner_task")
def compute_weekly_winner_task():
    """Compute last week's winner. Runs every Monday 00:05 UTC via Celery Beat."""
    asyncio.run(_compute())


async def _compute():
    from app.db import async_session
    from app.services.ranking_service import compute_weekly_winner

    async with async_session() as db:
        await compute_weekly_winner(db)


@celery_app.task(name="app.tasks.weekly_winner.pick_current_winner_task")
def pick_current_winner_task():
    """Pick the *current* week's winner from votes-so-far.

    Troubleshooting job — runs every 10 minutes so a winner becomes
    visible immediately after anyone votes, and updates as the
    leaderboard shifts. Upserts the WeeklyWinner row for the current
    week_bucket.
    """
    asyncio.run(_pick_current())


async def _pick_current():
    from app.db import async_session
    from app.services.ranking_service import pick_current_winner

    async with async_session() as db:
        await pick_current_winner(db)
