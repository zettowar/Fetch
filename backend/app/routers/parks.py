import math
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models.park import Park, ParkCheckin, ParkIncident, ParkReview
from app.models.user import User
from app.schemas.park import (
    ParkCreate,
    ParkIncidentCreate,
    ParkIncidentOut,
    ParkOut,
    ParkReviewCreate,
    ParkReviewOut,
    ParkUpdate,
)

router = APIRouter()


async def _park_to_out(park: Park, db: AsyncSession) -> ParkOut:
    avg_result = await db.execute(
        select(func.avg(ParkReview.rating)).where(ParkReview.park_id == park.id)
    )
    avg = avg_result.scalar()

    count_result = await db.execute(
        select(func.count()).where(ParkReview.park_id == park.id)
    )
    count = count_result.scalar() or 0

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
    deg_per_km = 1.0 / 111.32
    dlat = radius_km * deg_per_km
    dlng = radius_km * deg_per_km / max(math.cos(math.radians(lat)), 0.01)

    result = await db.execute(
        select(Park)
        .where(
            Park.lat.between(lat - dlat, lat + dlat),
            Park.lng.between(lng - dlng, lng + dlng),
        )
        .order_by(Park.name)
        .limit(100)
    )
    parks = result.scalars().all()
    return [await _park_to_out(p, db) for p in parks]


# --- CRUD ---

@router.post("", response_model=ParkOut, status_code=status.HTTP_201_CREATED)
async def create_park(
    body: ParkCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    park = Park(
        name=body.name,
        address=body.address,
        lat=body.lat,
        lng=body.lng,
        attributes=body.attributes,
        created_by=user.id,
        verified=False,
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


# --- Reviews ---

@router.post("/{park_id}/reviews", response_model=ParkReviewOut, status_code=status.HTTP_201_CREATED)
async def create_review(
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
    return ParkReviewOut(
        id=review.id,
        park_id=review.park_id,
        author_id=review.author_id,
        author_name=user.display_name,
        rating=review.rating,
        body=review.body,
        visit_time_of_day=review.visit_time_of_day,
        crowd_level=review.crowd_level,
        created_at=review.created_at,
    )


@router.get("/{park_id}/reviews", response_model=list[ParkReviewOut])
async def list_reviews(
    park_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ParkReview)
        .options(selectinload(ParkReview.author))
        .where(ParkReview.park_id == park_id)
        .order_by(ParkReview.created_at.desc())
        .limit(50)
    )
    reviews = result.scalars().all()
    return [
        ParkReviewOut(
            id=r.id,
            park_id=r.park_id,
            author_id=r.author_id,
            author_name=r.author.display_name if r.author else None,
            rating=r.rating,
            body=r.body,
            visit_time_of_day=r.visit_time_of_day,
            crowd_level=r.crowd_level,
            created_at=r.created_at,
        )
        for r in reviews
    ]


# --- Incidents ---

@router.post("/{park_id}/incidents", response_model=ParkIncidentOut, status_code=status.HTTP_201_CREATED)
async def create_incident(
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

@router.post("/{park_id}/checkin", status_code=status.HTTP_201_CREATED)
async def checkin(
    park_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Park).where(Park.id == park_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Park not found")

    ci = ParkCheckin(park_id=park_id, user_id=user.id)
    db.add(ci)
    await db.commit()
    return {"detail": "Checked in"}
