import asyncio
import logging

from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.lost_alerts.send_proximity_alerts")
def send_proximity_alerts(report_id: str):
    """Fan out proximity alerts to subscribed users near a new lost report."""
    asyncio.run(_send_alerts(report_id))


async def _send_alerts(report_id: str, session_factory=None):
    """session_factory is injectable so tests can point at their own database;
    the Celery path builds one against the app DATABASE_URL."""
    from uuid import UUID

    from sqlalchemy import select

    from app.config import settings
    from app.models.lost_report import LostReport
    from app.services.lost_service import get_matching_subscribers
    from app.tasks._session import task_session

    async with task_session(session_factory) as db:
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

        # …and anyone who turned lost-pet alerts off. The settings toggle and
        # the one-click unsubscribe both write this preference; until now
        # nothing read it, so switching it off changed nothing.
        from app.models.notification import NotificationPreference

        opted_out = set((await db.execute(
            select(NotificationPreference.user_id).where(
                NotificationPreference.user_id.in_({s.user_id for s in subscribers}),
                NotificationPreference.lost_dog_alerts == False,  # noqa: E712
            )
        )).scalars().all()) if subscribers else set()
        subscribers = [s for s in subscribers if s.user_id not in opted_out]

        logger.info(
            "Sending proximity alerts for report %s to %d subscribers",
            report_id,
            len(subscribers),
        )

        if not settings.RESEND_API_KEY:
            # Email delivery not configured — log who would have been notified.
            # (PHASE6: push notifications would also go out here.)
            for sub in subscribers:
                logger.info(
                    "Would notify user %s about report %s (distance within %s km)",
                    sub.user_id,
                    report_id,
                    sub.radius_km,
                )
        elif subscribers:
            from app.models.user import User
            from app.services.email import send_lost_alert_email

            email_result = await db.execute(
                select(User.id, User.email).where(
                    User.id.in_({s.user_id for s in subscribers}),
                    User.is_active == True,  # noqa: E712
                )
            )
            emails = dict(email_result.all())
            for sub in subscribers:
                to = emails.get(sub.user_id)
                if not to:
                    continue
                sent = await send_lost_alert_email(
                    to,
                    report_id=report_id,
                    description=report.description,
                    area_hint=None,
                    user_id=sub.user_id,
                )
                logger.info(
                    "Notified user %s about report %s (email_sent=%s)",
                    sub.user_id, report_id, sent,
                )

