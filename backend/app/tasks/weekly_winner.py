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
