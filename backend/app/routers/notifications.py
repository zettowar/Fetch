"""Notification preferences and push subscription management."""
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.notification import NotificationPreference, PushSubscription
from app.models.user import User
from app.schemas.notification import (
    NotificationPrefsOut,
    NotificationPrefsUpdate,
    PushSubscriptionCreate,
    PushSubscriptionOut,
)

router = APIRouter()


@router.post("/push/subscribe", response_model=PushSubscriptionOut, status_code=status.HTTP_201_CREATED)
async def subscribe_push(
    body: PushSubscriptionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub = PushSubscription(
        user_id=user.id, endpoint=body.endpoint,
        p256dh=body.p256dh, auth=body.auth,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.delete("/push/unsubscribe")
async def unsubscribe_push(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == user.id, PushSubscription.active == True
        )
    )
    for sub in result.scalars().all():
        sub.active = False
    await db.commit()
    return {"detail": "Unsubscribed from push notifications"}


@router.get("/preferences", response_model=NotificationPrefsOut)
async def get_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        return NotificationPrefsOut()
    return prefs


@router.patch("/preferences", response_model=NotificationPrefsOut)
async def update_preferences(
    body: NotificationPrefsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user.id)
    )
    prefs = result.scalar_one_or_none()
    if not prefs:
        prefs = NotificationPreference(user_id=user.id)
        db.add(prefs)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(prefs, field, value)

    await db.commit()
    await db.refresh(prefs)
    return prefs
