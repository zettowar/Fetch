"""Premium tier / billing router."""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models.audit_log import AuditLog
from app.models.entitlement import Entitlement
from app.models.user import User
from app.schemas.billing import EntitlementOut, ManualGrantRequest, PremiumStatus

router = APIRouter()


@router.get("/entitlements", response_model=list[EntitlementOut])
async def my_entitlements(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Entitlement).where(Entitlement.user_id == user.id)
    )
    return list(result.scalars().all())


@router.get("/status", response_model=PremiumStatus)
async def premium_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Entitlement)
        .where(
            Entitlement.user_id == user.id,
            Entitlement.entitlement_key == "ads_removed",
        )
        .order_by(Entitlement.created_at.desc())
    )
    # `first()` instead of scalar_one_or_none(): tolerate any pre-existing
    # duplicate rows. The grant endpoint is now idempotent.
    ent = result.scalars().first()
    is_premium = bool(ent and (not ent.expires_at or ent.expires_at > now))
    return PremiumStatus(
        is_premium=is_premium,
        entitlement=ent.entitlement_key if ent else None,
    )


@router.post("/grant", response_model=EntitlementOut, status_code=status.HTTP_201_CREATED)
async def grant_entitlement(
    body: ManualGrantRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == body.user_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    # Idempotent: if this user already holds this entitlement, return it
    # rather than creating a duplicate row (premium_status uses
    # scalar_one_or_none and would raise on multiples).
    existing = await db.execute(
        select(Entitlement).where(
            Entitlement.user_id == body.user_id,
            Entitlement.entitlement_key == body.entitlement_key,
        )
    )
    held = existing.scalar_one_or_none()
    if held is not None:
        return held

    ent = Entitlement(
        user_id=body.user_id,
        entitlement_key=body.entitlement_key,
        source=body.source,
    )
    db.add(ent)
    db.add(AuditLog(
        actor_id=admin.id,
        action="entitlement.grant",
        target_type="user",
        target_id=body.user_id,
        metadata_={"entitlement_key": body.entitlement_key, "source": body.source},
    ))
    await db.commit()
    await db.refresh(ent)
    return ent


@router.delete("/grant/{user_id}/{entitlement_key}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_entitlement(
    user_id: UUID,
    entitlement_key: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Entitlement).where(
            Entitlement.user_id == user_id,
            Entitlement.entitlement_key == entitlement_key,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Entitlement not found")
    await db.execute(
        delete(Entitlement).where(
            Entitlement.user_id == user_id,
            Entitlement.entitlement_key == entitlement_key,
        )
    )
    db.add(AuditLog(
        actor_id=admin.id,
        action="entitlement.revoke",
        target_type="user",
        target_id=user_id,
        metadata_={"entitlement_key": entitlement_key},
    ))
    await db.commit()
