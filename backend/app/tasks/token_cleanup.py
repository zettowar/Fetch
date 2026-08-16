import asyncio

from app.worker import celery_app


@celery_app.task(name="app.tasks.token_cleanup.purge_refresh_tokens_task")
def purge_refresh_tokens_task():
    """Delete refresh tokens that can never authenticate again.

    Every login and refresh inserts a row (rotation revokes the old one),
    so without a reaper the table grows unboundedly. Runs daily via Beat.
    """
    asyncio.run(_purge())


async def _purge(session_factory=None):
    from app.tasks._session import task_session

    async with task_session(session_factory) as db:
        await purge_dead_refresh_tokens(db)


async def purge_dead_refresh_tokens(db) -> int:
    from datetime import datetime, timezone

    import structlog
    from sqlalchemy import delete, or_

    from app.models.user import RefreshToken

    result = await db.execute(
        delete(RefreshToken).where(
            or_(
                RefreshToken.revoked == True,  # noqa: E712
                RefreshToken.expires_at < datetime.now(timezone.utc),
            )
        )
    )
    await db.commit()
    purged = result.rowcount or 0
    structlog.get_logger().info("refresh_tokens_purged", count=purged)
    return purged
