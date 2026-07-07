"""Unauthenticated read-only endpoints for the public share pages.

Deliberately narrow: a pet's share page shows the pet (never the owner's
identity), and only while the owner leaves the pet public (pets.is_public,
on by default, toggleable in the pet editor).
"""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models.pet import Pet
from app.models.user import User
from app.models.weekly_winner import WeeklyWinner
from app.services.breed_display import breed_display
from app.services.pet_serializer import display_photo_url
from app.storage import get_storage

router = APIRouter()


class PublicPetOut(BaseModel):
    id: UUID
    name: str
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

    storage = get_storage()
    approved = [p for p in pet.photos if p.moderation_status == "approved"]
    photo_urls = [storage.url(p.storage_key) for p in approved]

    rescue_name = None
    adoptable = False
    owner = pet.owner
    if owner is not None and owner.rescue_profile and owner.rescue_profile.status == "approved":
        rescue_name = owner.rescue_profile.org_name
        adoptable = pet.adopted_at is None

    crowns = await db.execute(
        select(WeeklyWinner.week_bucket)
        .where(WeeklyWinner.pet_id == pet.id)
        .order_by(WeeklyWinner.week_bucket.desc())
    )

    return PublicPetOut(
        id=pet.id,
        name=pet.name,
        breed_display=breed_display(pet.mix_type, pet.breeds, pet.species),
        birthday=pet.birthday,
        bio=pet.bio,
        traits=pet.traits or [],
        photo_urls=photo_urls,
        primary_photo_url=display_photo_url(pet),
        adoptable=adoptable,
        adopted=pet.adopted_at is not None,
        rescue_name=rescue_name,
        crown_weeks=list(crowns.scalars().all()),
    )


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
