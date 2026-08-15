"""Fan out an admin broadcast to every user in its segment.

Runs as a Celery task (not inline in the request) because a segment can be the
whole user base — tens of thousands of inbox rows. Inserts in batches and,
when requested, emails each recipient best-effort.
"""
import asyncio
import uuid

import structlog

from app.worker import celery_app

logger = structlog.get_logger()

_BATCH = 1000


@celery_app.task(name="app.tasks.announcements.dispatch_announcement_task")
def dispatch_announcement_task(announcement_id: str):
    return asyncio.run(_dispatch(uuid.UUID(announcement_id)))


def _segment_user_query(segment: str):
    """Return a SELECT of (id, email) for the users in `segment`."""
    from sqlalchemy import select
    from app.models.user import User
    from app.models.pet import Pet

    # Deactivated/suspended accounts never receive a broadcast, whatever the
    # segment — mailing someone you just suspended is both a bad look and a
    # deliverability risk.
    stmt = select(User.id, User.email).where(User.is_active == True)  # noqa: E712
    if segment == "active":
        pass
    elif segment == "with_pets":
        stmt = stmt.where(User.id.in_(select(Pet.owner_id).distinct()))
    elif segment == "rescues":
        stmt = stmt.where(User.role == "rescue")
    elif segment == "staff":
        stmt = stmt.where(User.role.in_(("admin", "moderator")))
    # "all" (or unknown) → no extra filter
    return stmt


async def _dispatch(announcement_id: uuid.UUID) -> int:
    from sqlalchemy import insert, select, update
    from app.db import async_session
    from app.models.announcement import Announcement
    from app.models.notification import Notification
    from app.services.email import send_email, _layout

    async with async_session() as db:
        ann = (await db.execute(
            select(Announcement).where(Announcement.id == announcement_id)
        )).scalar_one_or_none()
        if ann is None:
            logger.warning("announcement_missing", id=str(announcement_id))
            return 0

        rows = (await db.execute(_segment_user_query(ann.segment))).all()
        total = 0
        pending: list[dict] = []
        for uid, _email in rows:
            pending.append({
                "user_id": uid,
                "type": "announcement",
                "title": ann.title,
                "body": ann.body,
                "link": ann.link,
            })
            if len(pending) >= _BATCH:
                await db.execute(insert(Notification), pending)
                await db.commit()
                total += len(pending)
                pending = []
        if pending:
            await db.execute(insert(Notification), pending)
            await db.commit()
            total += len(pending)

        await db.execute(
            update(Announcement)
            .where(Announcement.id == announcement_id)
            .values(recipient_count=total)
        )
        await db.commit()

    # Email fan-out (best-effort, outside the DB transaction). Skipped entirely
    # when no email provider is configured.
    if ann.send_email:
        html = _layout(ann.title, ann.body)
        sent = 0
        for _uid, email in rows:
            if await send_email(email, ann.title, html):
                sent += 1
        logger.info("announcement_emailed", id=str(announcement_id), sent=sent)

    logger.info("announcement_dispatched", id=str(announcement_id), recipients=total)
    return total
