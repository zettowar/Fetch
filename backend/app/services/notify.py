"""In-app notification emission.

notify() adds a row to the caller's session WITHOUT committing, so the
notification lands atomically with the action that caused it (the caller owns
the transaction). Preference gating happens here for the types that have a
toggle; a missing preferences row means everything is on, matching the
defaults the preferences endpoint reports.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationPreference

# type -> NotificationPreference field that can switch it off
_PREF_FIELD = {
    "comment": "comments_on_dogs",
    "follow": "new_followers",
    "weekly_winner": "weekly_winner",
    "weekly_recap": "weekly_recap",
}


async def notify(
    db: AsyncSession,
    user_id: UUID,
    *,
    type: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
) -> bool:
    """Queue one inbox entry for user_id. Returns False if their preferences
    silence this type."""
    pref_field = _PREF_FIELD.get(type)
    if pref_field:
        prefs_result = await db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user_id
            )
        )
        prefs = prefs_result.scalar_one_or_none()
        if prefs is not None and not getattr(prefs, pref_field):
            return False

    db.add(Notification(
        user_id=user_id,
        type=type,
        title=title[:200],
        body=body,
        link=link,
    ))
    return True
