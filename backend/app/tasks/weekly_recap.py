"""Monday recap: tell each owner how their pets did last week.

The product's loop is rate → crown, but until now only the two crown winners
heard anything, and only in an inbox nobody is prompted to open. Everyone else
swiped, was swiped on, and got no signal at all — which is the retention half
of the loop simply missing.

Gated by the `weekly_recap_enabled` admin setting, default OFF: this mails every
active pet owner, so it must not start sending the moment the code ships. Turn
it on in Admin → Settings when weekly voting is dense enough that a recap is
worth receiving.
"""
import asyncio
from datetime import timedelta

import structlog

from app.worker import celery_app

logger = structlog.stdlib.get_logger()

# Below this, a recap reads as "nobody looked at your pet" — worse than silence.
MIN_LIKES_TO_SEND = 1

# Remembers the last week actually sent, so a second run for the same week is a
# no-op. Without it, an admin pressing "Run now" in Admin -> System, or Celery
# redelivering the task after a worker restart (task_acks_late is on), re-emails
# and re-notifies every owner.
SENT_MARKER_KEY = "weekly_recap_last_sent_week"


@celery_app.task(name="app.tasks.weekly_recap.send_weekly_recap_task")
def send_weekly_recap_task():
    """Runs Monday, after compute_weekly_winner has crowned the week."""
    return asyncio.run(_run())


async def _run(session_factory=None) -> int:
    """`session_factory` is injectable so tests can drive this against the test
    database — the app's default factory points at the real one."""
    from sqlalchemy import select

    from app.config import settings
    from app.db import async_session
    from app.models.notification import NotificationPreference
    from app.models.user import User
    from app.services import settings_service
    from app.services.email import send_weekly_recap_email
    from app.services.feed_service import current_week_bucket
    from app.services.notify import notify
    from app.services.ranking_service import get_week_standings

    if session_factory is None:
        session_factory = async_session

    last_week = current_week_bucket() - timedelta(days=7)
    week_before = last_week - timedelta(days=7)

    async with session_factory() as db:
        if not await settings_service.get_setting(db, "weekly_recap_enabled"):
            logger.info("weekly_recap_disabled")
            return 0

        # Two queries total, not per-pet: bounded by pets that were voted on
        # that week rather than by the size of the user base.
        already = await settings_service.get_setting(db, SENT_MARKER_KEY)
        if already == str(last_week):
            logger.info("weekly_recap_already_sent", week=str(last_week))
            return 0

        standings = await get_week_standings(db, last_week)
        if not standings:
            logger.info("weekly_recap_no_activity", week=str(last_week))
            return 0
        previous = await get_week_standings(db, week_before)

        totals: dict[str, int] = {}
        for row in standings.values():
            totals[row["species"]] = totals.get(row["species"], 0) + 1

        # Group each owner's pets into one email rather than one per pet.
        by_owner: dict = {}
        for pet_id, row in standings.items():
            if row["likes"] < MIN_LIKES_TO_SEND:
                continue
            prior = previous.get(pet_id)
            # A rank *number* going down is an improvement, hence prior - now.
            delta = (prior["rank"] - row["rank"]) if prior else None
            by_owner.setdefault(row["owner_id"], []).append({
                "name": row["pet_name"],
                "species": row["species"],
                "likes": int(row["likes"]),
                "rank": int(row["rank"]),
                "tied_with": int(row["tied_with"]),
                "total": totals[row["species"]],
                "delta": delta,
            })

        if not by_owner:
            logger.info("weekly_recap_nothing_worth_sending", week=str(last_week))
            return 0

        owner_ids = list(by_owner)
        users = {
            u.id: u for u in (await db.execute(
                select(User).where(
                    User.id.in_(owner_ids), User.is_active == True,  # noqa: E712
                )
            )).scalars().all()
        }
        opted_out = set((await db.execute(
            select(NotificationPreference.user_id).where(
                NotificationPreference.user_id.in_(owner_ids),
                NotificationPreference.weekly_recap == False,  # noqa: E712
            )
        )).scalars().all())

        week_label = last_week.strftime("%b %-d")
        sent = 0
        for owner_id, pets in by_owner.items():
            user = users.get(owner_id)
            if user is None:
                continue  # deactivated or deleted since the votes were cast

            # Sort by rank, then prefer an outright placing over a shared one.
            pets.sort(key=lambda p: (p["rank"], p["tied_with"]))
            best = pets[0]
            # Only claim a placing outright when it is not shared, or the mail
            # says "#1" to everyone tied on score.
            placing = (
                f"#{best['rank']}" if best["tied_with"] == 1
                else f"joint #{best['rank']}"
            )

            # The inbox entry lands for everyone whose pets were rated. Only
            # the email honours `weekly_recap` — unsubscribing from a mail
            # should not also silence the app's own surface.
            await notify(
                db, owner_id,
                type="weekly_recap",
                title=f"{best['name']} ranked {placing} last week",
                body=f"{best['likes']} like" + ("s" if best["likes"] != 1 else ""),
                link="/app/rankings",
            )

            # The opt-out gates the EMAIL only; the inbox entry above is the
            # app's own surface and is not what an unsubscribe link asked to
            # stop.
            if owner_id in opted_out:
                continue

            if settings.RESEND_API_KEY and await send_weekly_recap_email(
                user.email, user_id=owner_id, week_label=week_label, pets=pets,
            ):
                sent += 1

        # Marked inside the same transaction as the notifications, so a crash
        # before the commit leaves the week unmarked and safely retryable.
        await settings_service.set_setting(db, SENT_MARKER_KEY, str(last_week))
        await db.commit()

    logger.info(
        "weekly_recap_sent", week=str(last_week), owners=len(by_owner), emailed=sent
    )
    return sent
