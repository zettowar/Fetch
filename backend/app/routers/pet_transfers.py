"""Incoming transfer inbox + accept/decline for the recipient side.

Rescue-initiated creation lives in rescues.py (POST /rescues/pets/:id/transfer).
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.models.audit_log import AuditLog
from app.models.pet import Pet
from app.models.pet_transfer import PetTransfer
from app.models.rescue import RescueProfile
from app.models.user import User
from app.schemas.pet_transfer import PetTransferOut
from app.services.pet_serializer import display_photo_url
from app.services.notify import notify

router = APIRouter()


async def _serialize_transfers(
    transfers: list[PetTransfer], db: AsyncSession
) -> list[PetTransferOut]:
    """Batch-load pets and rescue names once, however many transfers there are."""
    pets: dict = {}
    rescue_names: dict = {}
    if transfers:
        pet_res = await db.execute(
            select(Pet)
            .options(selectinload(Pet.photos))
            .where(Pet.id.in_({t.pet_id for t in transfers}))
        )
        pets = {d.id: d for d in pet_res.scalars().all()}
        rp_res = await db.execute(
            select(RescueProfile.user_id, RescueProfile.org_name).where(
                RescueProfile.user_id.in_({t.from_user_id for t in transfers})
            )
        )
        rescue_names = dict(rp_res.all())
    return [_to_out(t, pets.get(t.pet_id), rescue_names.get(t.from_user_id)) for t in transfers]


def _to_out(t: PetTransfer, pet: Pet | None, rescue_name: str | None) -> PetTransferOut:
    photo_url = display_photo_url(pet)
    pet_name = pet.name if pet else None

    # Show "expired" for stale pending transfers without persisting the change
    # (a read endpoint shouldn't write). accept/decline re-check expiry inline.
    effective_status = t.status
    if t.status == "pending" and t.expires_at < datetime.now(timezone.utc):
        effective_status = "expired"

    return PetTransferOut(
        id=t.id,
        pet_id=t.pet_id,
        pet_name=pet_name,
        pet_photo_url=photo_url,
        from_user_id=t.from_user_id,
        from_rescue_name=rescue_name,
        to_user_id=t.to_user_id,
        invited_email=t.invited_email,
        status=effective_status,
        expires_at=t.expires_at,
        responded_at=t.responded_at,
        created_at=t.created_at,
    )


@router.get("/mine", response_model=list[PetTransferOut])
async def list_my_transfers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All transfers addressed to me — by user_id or by invited_email."""
    # Match both direct user_id assignment and latent email invites.
    result = await db.execute(
        select(PetTransfer)
        .where(
            or_(
                PetTransfer.to_user_id == user.id,
                PetTransfer.invited_email == user.email,
            )
        )
        .order_by(PetTransfer.created_at.desc())
    )
    transfers = list(result.scalars().all())
    return await _serialize_transfers(transfers, db)


@router.post("/{transfer_id}/accept", response_model=PetTransferOut)
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

    pet_res = await db.execute(select(Pet).where(Pet.id == t.pet_id))
    pet = pet_res.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet no longer exists")

    # Guard against a stale transfer: the pet may have been adopted, transferred
    # elsewhere, or reassigned since this invite was created. Accepting now must
    # not silently flip ownership of a pet the sender no longer holds.
    if pet.adopted_at is not None or pet.owner_id != t.from_user_id:
        t.status = "expired"
        t.responded_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(
            status_code=409,
            detail="This pet is no longer available for transfer",
        )

    now = datetime.now(timezone.utc)
    pet.owner_id = user.id
    pet.adopted_at = now
    pet.adopted_by_user_id = user.id
    t.status = "accepted"
    t.to_user_id = user.id
    t.responded_at = now

    await notify(
        db, t.from_user_id,
        type="transfer_resolved",
        title=f"{user.display_name} accepted the transfer of {pet.name}",
        link="/app/rescue/dashboard",
    )
    db.add(AuditLog(
        actor_id=user.id,
        action="pet.transfer_accepted",
        target_type="pet",
        target_id=pet.id,
        metadata_={"transfer_id": str(t.id), "from_user_id": str(t.from_user_id)},
    ))
    await db.commit()
    await db.refresh(t)
    return (await _serialize_transfers([t], db))[0]


@router.post("/{transfer_id}/decline", response_model=PetTransferOut)
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
    await notify(
        db, t.from_user_id,
        type="transfer_resolved",
        title=f"{user.display_name} declined a pet transfer",
        link="/app/rescue/dashboard",
    )
    db.add(AuditLog(
        actor_id=user.id,
        action="pet.transfer_declined",
        target_type="pet",
        target_id=t.pet_id,
        metadata_={"transfer_id": str(t.id)},
    ))
    await db.commit()
    await db.refresh(t)
    return (await _serialize_transfers([t], db))[0]


async def _load_transfer_for_user(
    transfer_id: UUID, user: User, db: AsyncSession
) -> PetTransfer:
    result = await db.execute(select(PetTransfer).where(PetTransfer.id == transfer_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    # Authorize: either directly assigned to this user, or invited by email —
    # but an email match only counts if the account's email is verified, so an
    # unverified user can't claim a pet by setting a victim's invited address.
    is_recipient = t.to_user_id == user.id or (
        t.invited_email is not None
        and t.invited_email == user.email
        and user.is_verified
    )
    if not is_recipient:
        raise HTTPException(status_code=403, detail="Not your transfer")
    return t
