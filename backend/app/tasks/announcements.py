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


async def _dispatch(announcement_id: uuid.UUID, session_factory=None) -> int:
    from sqlalchemy import insert, select, update
    from app.tasks._session import task_session
    from app.models.announcement import Announcement
    from app.models.notification import Notification
    from app.models.notification import NotificationPreference
    from app.services.email import (
        send_email, unsubscribe_footer, unsubscribe_headers, _layout,
    )

    async with task_session(session_factory) as db:
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
        # The in-app notification above goes to the whole segment; the *email*
        # is a commercial electronic message, so it additionally honours the
        # recipient's announcement opt-out.
        async with task_session(session_factory) as db:
            opted_out = set((await db.execute(
                select(NotificationPreference.user_id).where(
                    NotificationPreference.announcement_emails == False  # noqa: E712
                )
            )).scalars().all())

        sent = 0
        skipped = 0
        for uid, email in rows:
            if uid in opted_out:
                skipped += 1
                continue
            html = _layout(
                ann.title,
                ann.body + unsubscribe_footer(uid, "announcements"),
            )
            if await send_email(
                email, ann.title, html,
                headers=unsubscribe_headers(uid, "announcements"),
                kind="announcement",
            ):
                sent += 1
        logger.info(
            "announcement_emailed", id=str(announcement_id),
            sent=sent, opted_out=skipped,
        )

    logger.info("announcement_dispatched", id=str(announcement_id), recipients=total)
    return total
