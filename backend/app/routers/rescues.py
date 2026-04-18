"""Rescue account self-service + public directory + dog-transfer actions.

- `/api/v1/rescues`                          public directory (approved only)
- `/api/v1/rescues/:id`                      public detail
- `/api/v1/rescues/me`                       current rescue's own profile
- `/api/v1/rescues/me` (PATCH)               update own profile (approved only)
- `/api/v1/rescues/:id/dogs`                 public list of this rescue's active, unadopted dogs
- `/api/v1/rescues/dogs/:dog_id/mark-adopted` rescue flags dog as adopted (no transfer)
- `/api/v1/rescues/dogs/:dog_id/transfer`    rescue initiates a transfer to a Fetch user
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user, require_approved_rescue
from app.limiter import limiter
from app.models.audit_log import AuditLog
from app.models.dog import Dog
from app.models.dog_transfer import DogTransfer
from app.models.rescue import RescueProfile
from app.models.user import User
from app.routers.dogs import _dog_to_out, _get_dog_full
from app.schemas.dog import DogOut
from app.schemas.dog_transfer import DogTransferCreate, DogTransferOut
from app.schemas.rescue import (
    RescueProfileOut,
    RescueProfileUpdate,
    RescuePublicOut,
)

router = APIRouter()

TRANSFER_TTL_DAYS = 14


async def _rescue_name_for_user(user_id: UUID, db: AsyncSession) -> str | None:
    result = await db.execute(
        select(RescueProfile.org_name).where(
            RescueProfile.user_id == user_id,
            RescueProfile.status == "approved",
        )
    )
    row = result.first()
    return row[0] if row else None


# --- Public directory ---

@router.get("", response_model=list[RescuePublicOut])
async def list_rescues(
    q: str = Query(default=""),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(RescueProfile)
        .where(RescueProfile.status == "approved")
        .order_by(RescueProfile.org_name.asc())
        .limit(200)
    )
    if q:
        query = query.where(RescueProfile.org_name.ilike(f"%{q.strip()}%"))
    result = await db.execute(query)
    return list(result.scalars().all())


# --- Rescue self-service ---

@router.get("/me", response_model=RescueProfileOut)
async def get_my_rescue_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "rescue":
        raise HTTPException(status_code=404, detail="Not a rescue account")
    result = await db.execute(
        select(RescueProfile).where(RescueProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue profile not found")
    return profile


@router.patch("/me", response_model=RescueProfileOut)
async def update_my_rescue_profile(
    body: RescueProfileUpdate,
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RescueProfile).where(RescueProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue profile not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return profile


# Route ordering: parameterized /{rescue_id} must come AFTER /me.

@router.get("/{rescue_id}", response_model=RescuePublicOut)
async def get_rescue(
    rescue_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RescueProfile).where(
            RescueProfile.id == rescue_id,
            RescueProfile.status == "approved",
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue not found")
    return profile


@router.get("/{rescue_id}/dogs", response_model=list[DogOut])
async def list_rescue_dogs(
    rescue_id: UUID,
    include_adopted: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile_result = await db.execute(
        select(RescueProfile).where(
            RescueProfile.id == rescue_id,
            RescueProfile.status == "approved",
        )
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue not found")

    query = (
        select(Dog)
        .options(selectinload(Dog.photos), selectinload(Dog.breeds))
        .where(Dog.owner_id == profile.user_id, Dog.is_active == True)  # noqa: E712
        .order_by(Dog.created_at.desc())
    )
    if not include_adopted:
        query = query.where(Dog.adopted_at.is_(None))
    result = await db.execute(query)
    dogs = result.scalars().all()
    return [_dog_to_out(d, rescue_name=profile.org_name, rescue_id=profile.id) for d in dogs]


# --- Adoption actions (rescue-only) ---

@router.post("/dogs/{dog_id}/mark-adopted", response_model=DogOut)
@limiter.limit("60/hour")
async def mark_adopted(
    request: Request,
    dog_id: UUID,
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    """Flag a dog as adopted without transferring to a Fetch user."""
    dog = await _get_dog_full(dog_id, db)
    if dog.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your dog")
    if dog.adopted_at is not None:
        raise HTTPException(status_code=400, detail="Dog is already marked adopted")

    dog.adopted_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        actor_id=user.id,
        action="dog.mark_adopted",
        target_type="dog",
        target_id=dog.id,
    ))
    await db.commit()
    dog = await _get_dog_full(dog_id, db)
    rescue_name = await _rescue_name_for_user(user.id, db)
    return _dog_to_out(dog, rescue_name=rescue_name)


@router.post(
    "/dogs/{dog_id}/transfer",
    response_model=DogTransferOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("60/hour")
async def transfer_dog(
    request: Request,
    dog_id: UUID,
    body: DogTransferCreate,
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    """Start a transfer to a Fetch user. Ownership flips only once the
    recipient accepts. If they don't have Fetch yet, invite by email —
    they'll see the pending transfer when they sign up with that email."""
    dog = await _get_dog_full(dog_id, db)
    if dog.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your dog")
    if dog.adopted_at is not None:
        raise HTTPException(status_code=400, detail="Dog is already marked adopted")

    # Cancel any in-flight pending transfer for this dog.
    existing = await db.execute(
        select(DogTransfer).where(
            DogTransfer.dog_id == dog_id,
            DogTransfer.status == "pending",
        )
    )
    for t in existing.scalars().all():
        t.status = "cancelled"
        t.responded_at = datetime.now(timezone.utc)

    to_user_id: UUID | None = body.target_user_id
    invited_email: str | None = body.invited_email.lower() if body.invited_email else None

    # If we were given a user_id, verify they exist and are active.
    if to_user_id:
        target_res = await db.execute(
            select(User).where(User.id == to_user_id, User.is_active == True)  # noqa: E712
        )
        target = target_res.scalar_one_or_none()
        if not target:
            raise HTTPException(status_code=404, detail="Target user not found")
        if target.id == user.id:
            raise HTTPException(status_code=400, detail="Cannot transfer to yourself")
    elif invited_email:
        # Best-effort: resolve the email to a user_id now so they see the
        # transfer on first login. Otherwise the email-match happens later.
        target_res = await db.execute(
            select(User).where(User.email == invited_email, User.is_active == True)  # noqa: E712
        )
        target = target_res.scalar_one_or_none()
        if target:
            if target.id == user.id:
                raise HTTPException(status_code=400, detail="Cannot transfer to yourself")
            to_user_id = target.id
            invited_email = None

    transfer = DogTransfer(
        dog_id=dog.id,
        from_user_id=user.id,
        to_user_id=to_user_id,
        invited_email=invited_email,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=TRANSFER_TTL_DAYS),
    )
    db.add(transfer)
    db.add(AuditLog(
        actor_id=user.id,
        action="dog.transfer_initiated",
        target_type="dog",
        target_id=dog.id,
        metadata_={
            "to_user_id": str(to_user_id) if to_user_id else None,
            "invited_email": invited_email,
        },
    ))
    await db.commit()
    await db.refresh(transfer)
    return await _transfer_to_out(transfer, db)


async def _transfer_to_out(t: DogTransfer, db: AsyncSession) -> DogTransferOut:
    dog_res = await db.execute(
        select(Dog).options(selectinload(Dog.photos)).where(Dog.id == t.dog_id)
    )
    dog = dog_res.scalar_one_or_none()
    from app.storage import get_storage
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
    rescue_name = await _rescue_name_for_user(t.from_user_id, db)
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
