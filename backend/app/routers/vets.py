"""Veterinary clinic directory.

Public read paths plus admin create/edit. Discovery is geographic
(`/nearby` for a bbox-clipped list) — no reviews / check-ins / incidents
unlike Park, since vets are utility lookups rather than social hangouts.
"""
import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.models.user import User
from app.models.vet import Vet
from app.schemas.vet import VetCreate, VetOut, VetUpdate

router = APIRouter()


def _vet_to_out(v: Vet) -> VetOut:
    return VetOut(
        id=v.id,
        name=v.name,
        address=v.address,
        lat=v.lat,
        lng=v.lng,
        phone=v.phone,
        website=v.website,
        hours=v.hours,
        verified=v.verified,
        attributes=v.attributes,
        created_at=v.created_at,
    )


# --- Nearby (must come before parameterized /{vet_id}) ---

@router.get("/nearby", response_model=list[VetOut])
async def nearby_vets(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(15.0, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bounding-box approximation around (lat, lng). Same crude lat/lng
    rectangle as `/parks/nearby` — good enough at city scale, no PostGIS
    dependency."""
    deg_per_km = 1.0 / 111.32
    dlat = radius_km * deg_per_km
    dlng = radius_km * deg_per_km / max(math.cos(math.radians(lat)), 0.01)

    result = await db.execute(
        select(Vet)
        .where(
            Vet.lat.between(lat - dlat, lat + dlat),
            Vet.lng.between(lng - dlng, lng + dlng),
        )
        .order_by(Vet.name)
        .limit(200)
    )
    return [_vet_to_out(v) for v in result.scalars().all()]


# --- Admin create ---

@router.post("", response_model=VetOut, status_code=status.HTTP_201_CREATED)
async def create_vet(
    body: VetCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    vet = Vet(
        name=body.name,
        address=body.address,
        lat=body.lat,
        lng=body.lng,
        phone=body.phone,
        website=body.website,
        hours=body.hours,
        attributes=body.attributes,
        created_by=admin.id,
        verified=True,
        source="user",
    )
    db.add(vet)
    await db.commit()
    await db.refresh(vet)
    return _vet_to_out(vet)


# --- Public detail ---

@router.get("/{vet_id}", response_model=VetOut)
async def get_vet(
    vet_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Vet).where(Vet.id == vet_id))
    vet = result.scalar_one_or_none()
    if vet is None:
        raise HTTPException(status_code=404, detail="Vet not found")
    return _vet_to_out(vet)


@router.patch("/{vet_id}", response_model=VetOut)
async def update_vet(
    vet_id: UUID,
    body: VetUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Vet).where(Vet.id == vet_id))
    vet = result.scalar_one_or_none()
    if vet is None:
        raise HTTPException(status_code=404, detail="Vet not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(vet, field, value)
    await db.commit()
    await db.refresh(vet)
    return _vet_to_out(vet)
