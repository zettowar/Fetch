from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.limiter import limiter
from app.models.pet import Pet
from app.models.park import Park, ParkCheckin, ParkIncident, ParkReview
from app.models.user import User
from app.services.breed_display import breed_display
from app.services.geo import bounding_box
from app.services.pet_serializer import display_photo_url
from app.schemas.park import (
    CheckinCreate,
    ParkCheckinOut,
    ParkCreate,
    ParkIncidentCreate,
    ParkIncidentOut,
    ParkOut,
    ParkReviewCreate,
    ParkReviewOut,
    ParkUpdate,
)

router = APIRouter()

# How long an open check-in counts as "active" before it decays.
ACTIVE_CHECKIN_WINDOW = timedelta(hours=4)


def _active_checkin_cutoff() -> datetime:
    return datetime.now(timezone.utc) - ACTIVE_CHECKIN_WINDOW


async def _park_to_out(park: Park, db: AsyncSession) -> ParkOut:
    avg_result = await db.execute(
        select(func.avg(ParkReview.rating)).where(ParkReview.park_id == park.id)
    )
    avg = avg_result.scalar()

    count_result = await db.execute(
        select(func.count()).where(ParkReview.park_id == park.id)
    )
    count = count_result.scalar() or 0

    active_result = await db.execute(
        select(func.count()).where(
            ParkCheckin.park_id == park.id,
            ParkCheckin.checked_out_at == None,  # noqa: E711
            ParkCheckin.created_at > _active_checkin_cutoff(),
        )
    )
    active = active_result.scalar() or 0

    return ParkOut(
        id=park.id,
        name=park.name,
        address=park.address,
        lat=park.lat,
        lng=park.lng,
        verified=park.verified,
        attributes=park.attributes,
        avg_rating=round(float(avg), 1) if avg else None,
        review_count=count,
        active_pets_count=active,
        created_at=park.created_at,
    )


# --- Nearby ---

@router.get("/nearby", response_model=list[ParkOut])
async def nearby_parks(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10.0, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius_km)

    review_stats = (
        select(
            ParkReview.park_id.label("park_id"),
            func.avg(ParkReview.rating).label("avg_rating"),
            func.count(ParkReview.id).label("review_count"),
        )
        .group_by(ParkReview.park_id)
        .subquery()
    )

    cutoff = _active_checkin_cutoff()
    active_stats = (
        select(
            ParkCheckin.park_id.label("park_id"),
            func.count(ParkCheckin.id).label("active_count"),
        )
        .where(
            ParkCheckin.checked_out_at == None,  # noqa: E711
            ParkCheckin.created_at > cutoff,
        )
        .group_by(ParkCheckin.park_id)
        .subquery()
    )

    result = await db.execute(
        select(
            Park,
            review_stats.c.avg_rating,
            review_stats.c.review_count,
            active_stats.c.active_count,
        )
        .outerjoin(review_stats, review_stats.c.park_id == Park.id)
        .outerjoin(active_stats, active_stats.c.park_id == Park.id)
        .where(
            Park.lat.between(min_lat, max_lat),
            Park.lng.between(min_lng, max_lng),
        )
        .order_by(Park.name)
        .limit(100)
    )
    rows = result.all()
    return [
        ParkOut(
            id=park.id,
            name=park.name,
            address=park.address,
            lat=park.lat,
            lng=park.lng,
            verified=park.verified,
            attributes=park.attributes,
            avg_rating=round(float(avg_rating), 1) if avg_rating is not None else None,
            review_count=review_count or 0,
            active_pets_count=active_count or 0,
            created_at=park.created_at,
        )
        for park, avg_rating, review_count, active_count in rows
    ]


# --- CRUD ---

@router.post("", response_model=ParkOut, status_code=status.HTTP_201_CREATED)
async def create_park(
    body: ParkCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only. The public park library comes from the OSM import.
    This endpoint exists for one-off manual additions."""
    park = Park(
        name=body.name,
        address=body.address,
        lat=body.lat,
        lng=body.lng,
        attributes=body.attributes,
        created_by=admin.id,
        verified=True,
        source="user",
    )
    db.add(park)
    await db.commit()
    await db.refresh(park)
    return await _park_to_out(park, db)


@router.get("/{park_id}", response_model=ParkOut)
async def get_park(
    park_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Park).where(Park.id == park_id))
    park = result.scalar_one_or_none()
    if not park:
        raise HTTPException(status_code=404, detail="Park not found")
    return await _park_to_out(park, db)


@router.patch("/{park_id}", response_model=ParkOut)
async def update_park(
    park_id: UUID,
    body: ParkUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Park).where(Park.id == park_id))
    park = result.scalar_one_or_none()
    if not park:
        raise HTTPException(status_code=404, detail="Park not found")

    # Only admin or creator can update
    if park.created_by != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = body.model_dump(exclude_unset=True)
    # Only admin can set verified
    if "verified" in update_data and user.role != "admin":
        del update_data["verified"]

    for field, value in update_data.items():
        setattr(park, field, value)

    await db.commit()
    await db.refresh(park)
    return await _park_to_out(park, db)


@router.delete("/{park_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_park(
    park_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Park).where(Park.id == park_id))
    park = result.scalar_one_or_none()
    if not park:
        raise HTTPException(status_code=404, detail="Park not found")
    await db.delete(park)
    await db.commit()


# --- Reviews ---

def _review_to_out(review: ParkReview, author_name: str | None) -> ParkReviewOut:
    return ParkReviewOut(
        id=review.id,
        park_id=review.park_id,
        author_id=review.author_id,
        author_name=author_name,
        rating=review.rating,
        body=review.body,
        visit_time_of_day=review.visit_time_of_day,
        crowd_level=review.crowd_level,
        created_at=review.created_at,
    )


@router.post("/{park_id}/reviews", response_model=ParkReviewOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
async def create_review(
    request: Request,
    park_id: UUID,
    body: ParkReviewCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Park).where(Park.id == park_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Park not found")

    review = ParkReview(
        park_id=park_id,
        author_id=user.id,
        rating=body.rating,
        body=body.body,
        visit_time_of_day=body.visit_time_of_day,
        crowd_level=body.crowd_level,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return _review_to_out(review, user.display_name)


@router.get("/{park_id}/reviews", response_model=list[ParkReviewOut])
async def list_reviews(
    park_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ParkReview)
        .options(selectinload(ParkReview.author))
        .where(ParkReview.park_id == park_id)
        .order_by(ParkReview.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    reviews = result.scalars().all()
    return [_review_to_out(r, r.author.display_name if r.author else None) for r in reviews]


# --- Incidents ---

@router.post("/{park_id}/incidents", response_model=ParkIncidentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def create_incident(
    request: Request,
    park_id: UUID,
    body: ParkIncidentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Park).where(Park.id == park_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Park not found")

    incident = ParkIncident(
        park_id=park_id,
        reporter_id=user.id,
        kind=body.kind,
        description=body.description,
        expires_at=datetime.now(timezone.utc) + timedelta(days=14),
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return incident


@router.get("/{park_id}/incidents", response_model=list[ParkIncidentOut])
async def list_incidents(
    park_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(ParkIncident)
        .where(ParkIncident.park_id == park_id, ParkIncident.expires_at > now)
        .order_by(ParkIncident.created_at.desc())
    )
    return list(result.scalars().all())


# --- Check-ins ---

def _checkin_to_out(ci: ParkCheckin) -> ParkCheckinOut:
    photo_url = display_photo_url(ci.pet)

    return ParkCheckinOut(
        id=ci.id,
        park_id=ci.park_id,
        pet_id=ci.pet_id,
        pet_name=ci.pet.name if ci.pet else None,
        pet_breed=breed_display(ci.pet.mix_type, ci.pet.breeds, ci.pet.species) if ci.pet else None,
        pet_photo_url=photo_url,
        checked_in_at=ci.created_at,
        checked_out_at=ci.checked_out_at,
    )


@router.post("/{park_id}/checkin", response_model=ParkCheckinOut, status_code=status.HTTP_201_CREATED)
async def checkin(
    park_id: UUID,
    body: CheckinCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Park).where(Park.id == park_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Park not found")

    # Verify user owns the pet
    pet_result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.photos), selectinload(Pet.breeds))
        .where(Pet.id == body.pet_id, Pet.owner_id == user.id, Pet.is_active == True)
    )
    pet = pet_result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found or not yours")

    # End any existing active checkin for this pet at this park
    existing = await db.execute(
        select(ParkCheckin).where(
            ParkCheckin.pet_id == body.pet_id,
            ParkCheckin.checked_out_at == None,  # noqa: E711
        )
    )
    for old_ci in existing.scalars().all():
        old_ci.checked_out_at = datetime.now(timezone.utc)

    ci = ParkCheckin(park_id=park_id, user_id=user.id, pet_id=body.pet_id)
    db.add(ci)
    await db.commit()
    await db.refresh(ci)
    ci.pet = pet
    return _checkin_to_out(ci)


@router.delete("/{park_id}/checkin/{pet_id}", status_code=status.HTTP_200_OK)
async def checkout(
    park_id: UUID,
    pet_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ParkCheckin).where(
            ParkCheckin.park_id == park_id,
            ParkCheckin.pet_id == pet_id,
            ParkCheckin.user_id == user.id,
            ParkCheckin.checked_out_at == None,  # noqa: E711
        )
    )
    ci = result.scalar_one_or_none()
    if not ci:
        raise HTTPException(status_code=404, detail="No active check-in found")
    ci.checked_out_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Checked out"}


@router.get("/{park_id}/checkins", response_model=list[ParkCheckinOut])
async def list_checkins(
    park_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ParkCheckin)
        .options(
            selectinload(ParkCheckin.pet).selectinload(Pet.photos),
            selectinload(ParkCheckin.pet).selectinload(Pet.breeds),
        )
        .where(
            ParkCheckin.park_id == park_id,
            ParkCheckin.checked_out_at == None,  # noqa: E711
            ParkCheckin.created_at > _active_checkin_cutoff(),
        )
        .order_by(ParkCheckin.created_at.desc())
    )
    checkins = result.scalars().all()
    return [_checkin_to_out(ci) for ci in checkins]
