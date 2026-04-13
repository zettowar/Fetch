import asyncio
import logging

from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.lost_alerts.send_proximity_alerts")
def send_proximity_alerts(report_id: str):
    """Fan out proximity alerts to subscribed users near a new lost report."""
    asyncio.run(_send_alerts(report_id))


async def _send_alerts(report_id: str):
    from uuid import UUID

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.pool import NullPool

    from app.config import settings
    from app.models.lost_report import LostReport, LostReportSubscription
    from app.services.lost_service import get_matching_subscribers

    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        result = await db.execute(
            select(LostReport).where(LostReport.id == UUID(report_id))
        )
        report = result.scalar_one_or_none()
        if not report or not report.last_seen_lat or not report.last_seen_lng:
            logger.info("Report %s not found or has no coordinates, skipping alerts", report_id)
            return

        subscribers = await get_matching_subscribers(
            db, report.last_seen_lat, report.last_seen_lng
        )

        # Filter out the reporter themselves
        subscribers = [s for s in subscribers if s.user_id != report.reporter_id]

        logger.info(
            "Sending proximity alerts for report %s to %d subscribers",
            report_id,
            len(subscribers),
        )

        # PHASE6: Send actual push notifications and emails here
        for sub in subscribers:
            logger.info(
                "Would notify user %s about report %s (distance within %s km)",
                sub.user_id,
                report_id,
                sub.radius_km,
            )

    await engine.dispose()
