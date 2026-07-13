"""Unauthenticated read-only endpoints for the public share pages.

Deliberately narrow: a pet's share page shows the pet (never the owner's
identity), and only while the owner leaves the pet public (pets.is_public,
on by default, toggleable in the pet editor).
"""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models.pet import Pet
from app.models.qr_tag import QRTag
from app.models.rescue import RescueProfile
from app.models.user import User
from app.models.weekly_winner import WeeklyWinner
from app.services.breed_display import breed_display
from app.services.pet_serializer import display_photo_url
from app.storage import get_storage

router = APIRouter()


class SiteBannerOut(BaseModel):
    banner: str = ""


@router.get("/banner", response_model=SiteBannerOut)
async def site_banner(db: AsyncSession = Depends(get_db)):
    """Admin-set maintenance/announcement banner, shown to everyone. Empty
    string = no banner. Polled by the app shell."""
    from app.services import settings_service

    text = await settings_service.get_setting(db, "maintenance_banner")
    return SiteBannerOut(banner=text or "")


@router.get("/flags")
async def public_flags(db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    """Client-facing UI feature flags (Explore section gating). Unauthenticated
    so the app shell can grey out sections regardless of auth state."""
    from app.services import settings_service

    return {
        key: bool(await settings_service.get_setting(db, key))
        for key in settings_service.PUBLIC_FLAG_KEYS
    }


class PublicPetOut(BaseModel):
    id: UUID
    name: str
    species: str = "dog"
    breed_display: str | None = None
    birthday: date | None = None
    bio: str | None = None
    traits: list[str] = []
    photo_urls: list[str] = []
    primary_photo_url: str | None = None
    adoptable: bool = False
    adopted: bool = False
    rescue_name: str | None = None
    crown_weeks: list[date] = []


class PublicTopPetOut(BaseModel):
    pet_id: UUID
    pet_name: str
    species: str = "dog"
    week_bucket: date
    score: int
    photo_url: str | None = None


def _serialize_public_pet(
    pet: Pet, *, rescue_name: str | None, crown_weeks: list | None = None
) -> PublicPetOut:
    """Build a PublicPetOut from a Pet with photos/breeds eager-loaded."""
    storage = get_storage()
    approved = [p for p in pet.photos if p.moderation_status == "approved"]
    return PublicPetOut(
        id=pet.id,
        name=pet.name,
        species=pet.species,
        breed_display=breed_display(pet.mix_type, pet.breeds, pet.species),
        birthday=pet.birthday,
        bio=pet.bio,
        traits=pet.traits or [],
        photo_urls=[storage.url(p.storage_key) for p in approved],
        primary_photo_url=display_photo_url(pet),
        adoptable=rescue_name is not None and pet.adopted_at is None,
        adopted=pet.adopted_at is not None,
        rescue_name=rescue_name,
        crown_weeks=crown_weeks or [],
    )


@router.get("/pets/{pet_id}", response_model=PublicPetOut)
async def public_pet(pet_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Pet)
        .options(
            selectinload(Pet.photos),
            selectinload(Pet.breeds),
            selectinload(Pet.owner).selectinload(User.rescue_profile),
        )
        .where(Pet.id == pet_id, Pet.is_active == True, Pet.is_public == True)  # noqa: E712
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    owner = pet.owner
    rescue_name = None
    if owner is not None and owner.rescue_profile and owner.rescue_profile.status == "approved":
        rescue_name = owner.rescue_profile.org_name

    crowns = await db.execute(
        select(WeeklyWinner.week_bucket)
        .where(WeeklyWinner.pet_id == pet.id)
        .order_by(WeeklyWinner.week_bucket.desc())
    )
    return _serialize_public_pet(
        pet, rescue_name=rescue_name, crown_weeks=list(crowns.scalars().all())
    )


class PublicRescueOut(BaseModel):
    id: UUID
    slug: str | None = None
    org_name: str
    description: str
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    website: str | None = None
    donation_url: str | None = None
    donations_enabled: bool = False
    logo_url: str | None = None
    cover_url: str | None = None
    pets: list[PublicPetOut] = []


_IMAGE_MEDIA_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


@router.get("/rescues/images/{key}")
async def public_rescue_image(key: str, db: AsyncSession = Depends(get_db)):
    """Serve a rescue logo/cover — but only if `key` is actually a rescue image
    (never an arbitrary storage key)."""
    exists = (await db.execute(
        select(RescueProfile.id).where(
            or_(RescueProfile.logo_key == key, RescueProfile.cover_key == key)
        )
    )).first()
    if exists is None:
        raise HTTPException(status_code=404, detail="Image not found")
    storage = get_storage()
    try:
        data = await storage.get(key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    ext = key.rsplit(".", 1)[-1].lower() if "." in key else ""
    return Response(content=data, media_type=_IMAGE_MEDIA_TYPES.get(ext, "application/octet-stream"))


@router.get("/rescues/{slug}", response_model=PublicRescueOut)
async def public_rescue(slug: str, db: AsyncSession = Depends(get_db)):
    """The rescue's public 'website' page — approved + is_public only."""
    result = await db.execute(
        select(RescueProfile).where(
            RescueProfile.slug == slug,
            RescueProfile.status == "approved",
            RescueProfile.is_public == True,  # noqa: E712
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue not found")

    pets_result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.photos), selectinload(Pet.breeds))
        .where(
            Pet.owner_id == profile.user_id,
            Pet.is_active == True,  # noqa: E712
            Pet.is_public == True,  # noqa: E712
            Pet.adopted_at.is_(None),
        )
        .order_by(Pet.created_at.desc())
    )
    pets = [
        _serialize_public_pet(p, rescue_name=profile.org_name)
        for p in pets_result.scalars().all()
    ]

    return PublicRescueOut(
        id=profile.id,
        slug=profile.slug,
        org_name=profile.org_name,
        description=profile.description,
        location=profile.location,
        lat=profile.lat,
        lng=profile.lng,
        website=profile.website,
        donation_url=profile.donation_url,
        donations_enabled=profile.donations_enabled,
        logo_url=profile.logo_url,
        cover_url=profile.cover_url,
        pets=pets,
    )


class PublicTagOut(BaseModel):
    """Resolution for a scanned QR tag."""
    assigned: bool = False
    pet: PublicPetOut | None = None


@router.get("/tags/{code}", response_model=PublicTagOut)
async def public_tag(code: str, db: AsyncSession = Depends(get_db)):
    """Resolve a scanned tag code to its pet's public profile. Unknown code →
    404; unassigned → assigned:false; assigned but private/removed → pet:null."""
    tag = (
        await db.execute(select(QRTag).where(QRTag.code == code.strip().upper()))
    ).scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Unknown tag")
    if tag.pet_id is None:
        return PublicTagOut(assigned=False, pet=None)

    pet = (await db.execute(
        select(Pet)
        .options(
            selectinload(Pet.photos),
            selectinload(Pet.breeds),
            selectinload(Pet.owner).selectinload(User.rescue_profile),
        )
        .where(Pet.id == tag.pet_id, Pet.is_active == True, Pet.is_public == True)  # noqa: E712
    )).scalar_one_or_none()
    if not pet:
        return PublicTagOut(assigned=True, pet=None)

    owner = pet.owner
    rescue_name = None
    if owner is not None and owner.rescue_profile and owner.rescue_profile.status == "approved":
        rescue_name = owner.rescue_profile.org_name
    return PublicTagOut(assigned=True, pet=_serialize_public_pet(pet, rescue_name=rescue_name))


@router.get("/top-pet", response_model=PublicTopPetOut | None)
async def public_top_pet(
    species: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """The current Top Dog / Top Cat, if the crowned pet's share page is public."""
    q = select(WeeklyWinner).order_by(WeeklyWinner.week_bucket.desc())
    if species in ("dog", "cat"):
        q = q.where(WeeklyWinner.species == species)
    winner_result = await db.execute(q.limit(1))
    winner = winner_result.scalar_one_or_none()
    if not winner or winner.pet_id is None:
        return None

    pet_result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.photos))
        .where(
            Pet.id == winner.pet_id,
            Pet.is_active == True,  # noqa: E712
            Pet.is_public == True,  # noqa: E712
        )
    )
    pet = pet_result.scalar_one_or_none()
    if not pet:
        return None

    return PublicTopPetOut(
        pet_id=pet.id,
        pet_name=pet.name,
        species=winner.species,
        week_bucket=winner.week_bucket,
        score=winner.score,
        photo_url=display_photo_url(pet),
    )
