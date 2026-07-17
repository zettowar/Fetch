"""Daily notification digest — the delivery channel that makes the long-dead
`digest_mode` preference actually do something.

Runs daily via Beat. Users with digest_mode='daily' get a summary of their
unread inbox from the last day; digest_mode='weekly' users get one only on
Mondays (covering the last 7 days). Requires an email provider — a no-op
otherwise, same as every other email path.
"""
import asyncio
import html
from datetime import datetime, timedelta, timezone

import structlog

from app.worker import celery_app

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.digest.send_digest_task")
def send_digest_task():
    return asyncio.run(_run())


def _render_items(unread) -> str:
    """Build the digest's <li> list. Titles/bodies embed user-controlled
    strings (display names, comment excerpts, donation messages), so escape
    them — a crafted name must not inject markup/phishing links into the email."""
    return "".join(
        f"<li style='margin-bottom:6px'><strong>{html.escape(n.title)}</strong>"
        + (f"<br>{html.escape(n.body)}" if n.body else "")
        + "</li>"
        for n in unread
    )


async def _run() -> int:
    from sqlalchemy import select
    from app.config import settings
    from app.db import async_session
    from app.models.notification import Notification, NotificationPreference
    from app.models.user import User
    from app.services.email import send_email, _layout

    if not settings.RESEND_API_KEY:
        logger.info("digest_skipped_no_provider")
        return 0

    now = datetime.now(timezone.utc)
    is_monday = now.weekday() == 0
    # Which cadences fire today, and how far back each looks.
    windows: dict[str, datetime] = {"daily": now - timedelta(days=1)}
    if is_monday:
        windows["weekly"] = now - timedelta(days=7)

    sent = 0
    async with async_session() as db:
        prefs = (await db.execute(
            select(NotificationPreference.user_id, NotificationPreference.digest_mode)
            .where(NotificationPreference.digest_mode.in_(list(windows.keys())))
        )).all()

        for user_id, mode in prefs:
            since = windows[mode]
            unread = (await db.execute(
                select(Notification)
                .where(
                    Notification.user_id == user_id,
                    Notification.read_at.is_(None),
                    Notification.created_at >= since,
                )
                .order_by(Notification.created_at.desc())
                .limit(20)
            )).scalars().all()
            if not unread:
                continue

            user = (await db.execute(
                select(User).where(User.id == user_id, User.is_active == True)  # noqa: E712
            )).scalar_one_or_none()
            if user is None:
                continue

            items = _render_items(unread)
            heading = f"You have {len(unread)} new notification" + ("s" if len(unread) != 1 else "")
            html = _layout(
                heading,
                f"<ul style='padding-left:18px'>{items}</ul>",
                cta_url=f"{settings.FRONTEND_BASE_URL}/app/inbox",
                cta_label="Open your inbox",
            )
            if await send_email(user.email, f"Fetchpawz — {heading.lower()}", html):
                sent += 1

    logger.info("digest_sent", count=sent)
    return sent
