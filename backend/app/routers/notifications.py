"""Notification inbox, preferences, and push subscription management."""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.notification import Notification, NotificationPreference, PushSubscription
from app.models.user import User
from app.schemas.notification import (
    NotificationOut,
    NotificationPrefsOut,
    NotificationPrefsUpdate,
    PushSubscriptionCreate,
    PushSubscriptionOut,
)

router = APIRouter()


# --- Inbox ---

@router.get("/inbox", response_model=list[NotificationOut])
async def list_inbox(
    response: Response,
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total = (
        await db.execute(
            select(func.count()).select_from(Notification).where(Notification.user_id == user.id)
        )
    ).scalar() or 0
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    response.headers["X-Total-Count"] = str(total)
    return list(result.scalars().all())


@router.get("/inbox/unread-count")
async def unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = (
        await db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.user_id == user.id,
                Notification.read_at.is_(None),
            )
        )
    ).scalar() or 0
    return {"count": count}


@router.post("/inbox/read-all")
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return {"detail": "All notifications marked read"}


@router.post("/inbox/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(notification)
    return notification


@router.post("/push/subscribe", response_model=PushSubscriptionOut, status_code=status.HTTP_201_CREATED)
async def subscribe_push(
    body: PushSubscriptionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Upsert by (user_id, endpoint): re-subscribing from the same browser must
    # refresh the existing row rather than pile up duplicate active rows.
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id == user.id,
            PushSubscription.endpoint == body.endpoint,
        )
    )
    sub = result.scalar_one_or_none()
    if sub:
        sub.p256dh = body.p256dh
        sub.auth = body.auth
        sub.active = True
    else:
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
