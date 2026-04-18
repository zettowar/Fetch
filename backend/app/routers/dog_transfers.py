"""Incoming transfer inbox + accept/decline for the recipient side.

Rescue-initiated creation lives in rescues.py (POST /rescues/dogs/:id/transfer).
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.models.audit_log import AuditLog
from app.models.dog import Dog
from app.models.dog_transfer import DogTransfer
from app.models.rescue import RescueProfile
from app.models.user import User
from app.schemas.dog_transfer import DogTransferOut
from app.storage import get_storage

router = APIRouter()


async def _expire_stale(transfer: DogTransfer) -> None:
    if transfer.status == "pending" and transfer.expires_at < datetime.now(timezone.utc):
        transfer.status = "expired"


async def _to_out(t: DogTransfer, db: AsyncSession) -> DogTransferOut:
    dog_res = await db.execute(
        select(Dog).options(selectinload(Dog.photos)).where(Dog.id == t.dog_id)
    )
    dog = dog_res.scalar_one_or_none()
    storage = get_storage()
    photo_url = None
    dog_name = None
    if dog:
        dog_name = dog.name
        if dog.primary_photo_id:
            for p in dog.photos:
                if p.id == dog.primary_photo_id:
                    photo_url = storage.url(p.storage_key)
                    break

    rescue_name = None
    rp_res = await db.execute(
        select(RescueProfile.org_name).where(RescueProfile.user_id == t.from_user_id)
    )
    row = rp_res.first()
    if row:
        rescue_name = row[0]

    return DogTransferOut(
        id=t.id,
        dog_id=t.dog_id,
        dog_name=dog_name,
        dog_photo_url=photo_url,
        from_user_id=t.from_user_id,
        from_rescue_name=rescue_name,
        to_user_id=t.to_user_id,
        invited_email=t.invited_email,
        status=t.status,
        expires_at=t.expires_at,
        responded_at=t.responded_at,
        created_at=t.created_at,
    )


@router.get("/mine", response_model=list[DogTransferOut])
async def list_my_transfers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All transfers addressed to me — by user_id or by invited_email."""
    # Match both direct user_id assignment and latent email invites.
    result = await db.execute(
        select(DogTransfer)
        .where(
            or_(
                DogTransfer.to_user_id == user.id,
                DogTransfer.invited_email == user.email,
            )
        )
        .order_by(DogTransfer.created_at.desc())
    )
    transfers = list(result.scalars().all())

    # Attach email-only transfers to this user opportunistically.
    changed = False
    for t in transfers:
        if t.to_user_id is None and t.invited_email == user.email:
            t.to_user_id = user.id
            changed = True
        await _expire_stale(t)
    if changed:
        await db.commit()

    return [await _to_out(t, db) for t in transfers]


@router.post("/{transfer_id}/accept", response_model=DogTransferOut)
async def accept_transfer(
    transfer_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    t = await _load_transfer_for_user(transfer_id, user, db)
    if t.status != "pending":
        raise HTTPException(status_code=400, detail=f"Transfer is {t.status}")
    if t.expires_at < datetime.now(timezone.utc):
        t.status = "expired"
        await db.commit()
        raise HTTPException(status_code=400, detail="Transfer has expired")

    dog_res = await db.execute(select(Dog).where(Dog.id == t.dog_id))
    dog = dog_res.scalar_one_or_none()
    if not dog:
        raise HTTPException(status_code=404, detail="Dog no longer exists")

    now = datetime.now(timezone.utc)
    dog.owner_id = user.id
    dog.adopted_at = now
    dog.adopted_by_user_id = user.id
    t.status = "accepted"
    t.to_user_id = user.id
    t.responded_at = now

    db.add(AuditLog(
        actor_id=user.id,
        action="dog.transfer_accepted",
        target_type="dog",
        target_id=dog.id,
        metadata_={"transfer_id": str(t.id), "from_user_id": str(t.from_user_id)},
    ))
    await db.commit()
    await db.refresh(t)
    return await _to_out(t, db)


@router.post("/{transfer_id}/decline", response_model=DogTransferOut)
async def decline_transfer(
    transfer_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    t = await _load_transfer_for_user(transfer_id, user, db)
    if t.status != "pending":
        raise HTTPException(status_code=400, detail=f"Transfer is {t.status}")
    t.status = "declined"
    t.responded_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        actor_id=user.id,
        action="dog.transfer_declined",
        target_type="dog",
        target_id=t.dog_id,
        metadata_={"transfer_id": str(t.id)},
    ))
    await db.commit()
    await db.refresh(t)
    return await _to_out(t, db)


async def _load_transfer_for_user(
    transfer_id: UUID, user: User, db: AsyncSession
) -> DogTransfer:
    result = await db.execute(select(DogTransfer).where(DogTransfer.id == transfer_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    # Authorize: must be the addressed recipient (user_id match or email match).
    is_recipient = t.to_user_id == user.id or t.invited_email == user.email
    if not is_recipient:
        raise HTTPException(status_code=403, detail="Not your transfer")
    return t
