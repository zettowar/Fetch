"""Rescue account self-service + public directory + pet-transfer actions.

- `/api/v1/rescues`                          public directory (approved only)
- `/api/v1/rescues/:id`                      public detail
- `/api/v1/rescues/me`                       current rescue's own profile
- `/api/v1/rescues/me` (PATCH)               update own profile (approved only)
- `/api/v1/rescues/:id/pets`                 public list of this rescue's active, unadopted pets
- `/api/v1/rescues/pets/:pet_id/mark-adopted` rescue flags pet as adopted (no transfer)
- `/api/v1/rescues/pets/:pet_id/transfer`    rescue initiates a transfer to a Fetchpawz user
"""
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import (
    APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Request,
    UploadFile, status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.services.rescue_service import prepare_rescue_image
from app.storage import generate_storage_key, get_storage

from app.db import get_db
from app.deps import get_current_user, require_approved_rescue
from app.limiter import limiter
from app.models.audit_log import AuditLog
from app.models.beta import InviteCode
from app.models.pet import Pet
from app.models.pet_transfer import PetTransfer
from app.models.rescue import RescueProfile
from app.models.user import User
from app.services.pet_serializer import (
    display_photo_url,
    pet_to_out as _pet_to_out,
    get_pet_full as _get_pet_full,
)
from app.services.notify import notify
from app.services.email import send_transfer_invite_email
from app.services.geo import bounding_box
from app.schemas.pet import PetOut
from app.schemas.pet_transfer import PetTransferCreate, PetTransferOut
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
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(RescueProfile)
        .where(RescueProfile.status == "approved")
        .order_by(RescueProfile.org_name.asc())
        .limit(limit)
        .offset(offset)
    )
    if q:
        query = query.where(RescueProfile.org_name.ilike(f"%{q.strip()}%"))
    result = await db.execute(query)
    return list(result.scalars().all())


# --- Nearby (route must precede parameterized /{rescue_id}) ---

@router.get("/nearby", response_model=list[RescuePublicOut])
async def nearby_rescues(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(50.0, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius_km)

    result = await db.execute(
        select(RescueProfile)
        .where(
            RescueProfile.status == "approved",
            RescueProfile.lat.is_not(None),
            RescueProfile.lng.is_not(None),
            RescueProfile.lat.between(min_lat, max_lat),
            RescueProfile.lng.between(min_lng, max_lng),
        )
        .order_by(RescueProfile.org_name.asc())
        .limit(200)
    )
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


# --- Public-page images (logo + cover) ---

_IMAGE_MAX_DIM = {"logo": 512, "cover": 1600}


async def _set_rescue_image(
    kind: str, file: UploadFile, user: User, db: AsyncSession
) -> RescueProfile:
    result = await db.execute(
        select(RescueProfile).where(RescueProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue profile not found")

    data = await file.read()
    try:
        out, content_type, _w, _h = prepare_rescue_image(data, _IMAGE_MAX_DIM[kind])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    storage = get_storage()
    key = generate_storage_key(content_type)
    await storage.put(key, out, content_type)

    old_key = getattr(profile, f"{kind}_key")
    setattr(profile, f"{kind}_key", key)
    await db.commit()
    await db.refresh(profile)

    if old_key:  # reclaim the replaced file
        try:
            await storage.delete(old_key)
        except Exception:
            pass
    return profile


@router.post("/me/logo", response_model=RescueProfileOut)
async def upload_rescue_logo(
    file: UploadFile = File(...),
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    return await _set_rescue_image("logo", file, user, db)


@router.post("/me/cover", response_model=RescueProfileOut)
async def upload_rescue_cover(
    file: UploadFile = File(...),
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    return await _set_rescue_image("cover", file, user, db)


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


@router.get("/{rescue_id}/pets", response_model=list[PetOut])
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
        select(Pet)
        .options(selectinload(Pet.photos), selectinload(Pet.breeds))
        .where(Pet.owner_id == profile.user_id, Pet.is_active == True)  # noqa: E712
        .order_by(Pet.created_at.desc())
    )
    if not include_adopted:
        query = query.where(Pet.adopted_at.is_(None))
    result = await db.execute(query)
    pets = result.scalars().all()
    return [_pet_to_out(d, rescue_name=profile.org_name, rescue_id=profile.id) for d in pets]


# --- Adoption actions (rescue-only) ---

@router.post("/pets/{pet_id}/mark-adopted", response_model=PetOut)
@limiter.limit("60/hour")
async def mark_adopted(
    request: Request,
    pet_id: UUID,
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    """Flag a pet as adopted without transferring to a Fetchpawz user."""
    pet = await _get_pet_full(pet_id, db)
    if pet.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your pet")
    if pet.adopted_at is not None:
        raise HTTPException(status_code=400, detail="Pet is already marked adopted")

    pet.adopted_at = datetime.now(timezone.utc)
    # Adopting externally voids any in-flight transfer invite — otherwise it
    # lingers in the invitee's inbox (accept now 409s, but don't dangle it).
    pending = await db.execute(
        select(PetTransfer).where(
            PetTransfer.pet_id == pet_id,
            PetTransfer.status == "pending",
        )
    )
    for t in pending.scalars().all():
        t.status = "cancelled"
        t.responded_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        actor_id=user.id,
        action="pet.mark_adopted",
        target_type="pet",
        target_id=pet.id,
    ))
    await db.commit()
    pet = await _get_pet_full(pet_id, db)
    rescue_name = await _rescue_name_for_user(user.id, db)
    return _pet_to_out(pet, rescue_name=rescue_name)


@router.post(
    "/pets/{pet_id}/transfer",
    response_model=PetTransferOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("60/hour")
async def transfer_dog(
    request: Request,
    pet_id: UUID,
    body: PetTransferCreate,
    background_tasks: BackgroundTasks,
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    """Start a transfer to a Fetchpawz user. Ownership flips only once the
    recipient accepts. If they don't have Fetchpawz yet, invite by email —
    they'll see the pending transfer when they sign up with that email."""
    pet = await _get_pet_full(pet_id, db)
    if pet.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your pet")
    if pet.adopted_at is not None:
        raise HTTPException(status_code=400, detail="Pet is already marked adopted")

    # Cancel any in-flight pending transfer for this pet.
    existing = await db.execute(
        select(PetTransfer).where(
            PetTransfer.pet_id == pet_id,
            PetTransfer.status == "pending",
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

    transfer = PetTransfer(
        pet_id=pet.id,
        from_user_id=user.id,
        to_user_id=to_user_id,
        invited_email=invited_email,
        status="pending",
        expires_at=datetime.now(timezone.utc) + timedelta(days=TRANSFER_TTL_DAYS),
    )
    db.add(transfer)

    rescue_name = await _rescue_name_for_user(user.id, db) or user.display_name

    if to_user_id is not None:
        await notify(
            db, to_user_id,
            type="transfer_received",
            title=f"{pet.name} is waiting for you",
            body="Review the transfer invitation to take ownership.",
            link="/app/transfers",
        )
        # The in-app inbox is the only channel notify() has, and nobody is told
        # to open it — so the transfer also goes out by email. Existing member,
        # so no invite code is needed.
        target_email = target.email if target else None
        if target_email:
            background_tasks.add_task(
                send_transfer_invite_email,
                target_email,
                pet_name=pet.name,
                rescue_name=rescue_name,
                signup_code=None,
                expires_days=TRANSFER_TTL_DAYS,
            )
    elif invited_email:
        # Nobody by this address yet. Previously this branch sent nothing at
        # all: the adopter was never told, and with INVITE_REQUIRED they could
        # not have signed up to discover it either — the transfer just expired.
        #
        # Mint a single-use invite so the link actually works through the beta
        # gate. It is one code for one seat, the same trade the admin waitlist
        # flow already makes, and it dies when it is used or when the person
        # never shows up.
        signup_code = f"FETCH-{secrets.token_hex(4).upper()}"
        # Bound to the invited address: forwarding the email does not hand
        # someone else a way through the beta gate.
        db.add(InviteCode(
            code=signup_code, created_by=user.id, invited_email=invited_email,
        ))
        background_tasks.add_task(
            send_transfer_invite_email,
            invited_email,
            pet_name=pet.name,
            rescue_name=rescue_name,
            signup_code=signup_code,
            expires_days=TRANSFER_TTL_DAYS,
        )
    db.add(AuditLog(
        actor_id=user.id,
        action="pet.transfer_initiated",
        target_type="pet",
        target_id=pet.id,
        metadata_={
            "to_user_id": str(to_user_id) if to_user_id else None,
            "invited_email": invited_email,
        },
    ))
    await db.commit()
    await db.refresh(transfer)
    return await _transfer_to_out(transfer, db)


async def _transfer_to_out(t: PetTransfer, db: AsyncSession) -> PetTransferOut:
    pet_res = await db.execute(
        select(Pet).options(selectinload(Pet.photos)).where(Pet.id == t.pet_id)
    )
    pet = pet_res.scalar_one_or_none()
    photo_url = display_photo_url(pet)
    pet_name = pet.name if pet else None
    rescue_name = await _rescue_name_for_user(t.from_user_id, db)
    return PetTransferOut(
        id=t.id,
        pet_id=t.pet_id,
        pet_name=pet_name,
        pet_photo_url=photo_url,
        from_user_id=t.from_user_id,
        from_rescue_name=rescue_name,
        to_user_id=t.to_user_id,
        invited_email=t.invited_email,
        status=t.status,
        expires_at=t.expires_at,
        responded_at=t.responded_at,
        created_at=t.created_at,
    )
