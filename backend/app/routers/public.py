"""Unauthenticated read-only endpoints for the public share pages.

Deliberately narrow: a dog's share page shows the dog (never the owner's
identity), and only while the owner leaves the dog public (dogs.is_public,
on by default, toggleable in the dog editor).
"""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models.dog import Dog
from app.models.user import User
from app.models.weekly_winner import WeeklyWinner
from app.services.breed_display import breed_display
from app.services.dog_serializer import display_photo_url
from app.storage import get_storage

router = APIRouter()


class PublicDogOut(BaseModel):
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


class PublicTopDogOut(BaseModel):
    dog_id: UUID
    dog_name: str
    week_bucket: date
    score: int
    photo_url: str | None = None


@router.get("/dogs/{dog_id}", response_model=PublicDogOut)
async def public_dog(dog_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Dog)
        .options(
            selectinload(Dog.photos),
            selectinload(Dog.breeds),
            selectinload(Dog.owner).selectinload(User.rescue_profile),
        )
        .where(Dog.id == dog_id, Dog.is_active == True, Dog.is_public == True)  # noqa: E712
    )
    dog = result.scalar_one_or_none()
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found")

    storage = get_storage()
    approved = [p for p in dog.photos if p.moderation_status == "approved"]
    photo_urls = [storage.url(p.storage_key) for p in approved]

    rescue_name = None
    adoptable = False
    owner = dog.owner
    if owner is not None and owner.rescue_profile and owner.rescue_profile.status == "approved":
        rescue_name = owner.rescue_profile.org_name
        adoptable = dog.adopted_at is None

    crowns = await db.execute(
        select(WeeklyWinner.week_bucket)
        .where(WeeklyWinner.dog_id == dog.id)
        .order_by(WeeklyWinner.week_bucket.desc())
    )

    return PublicDogOut(
        id=dog.id,
        name=dog.name,
        breed_display=breed_display(dog.mix_type, dog.breeds),
        birthday=dog.birthday,
        bio=dog.bio,
        traits=dog.traits or [],
        photo_urls=photo_urls,
        primary_photo_url=display_photo_url(dog),
        adoptable=adoptable,
        adopted=dog.adopted_at is not None,
        rescue_name=rescue_name,
        crown_weeks=list(crowns.scalars().all()),
    )


@router.get("/top-dog", response_model=PublicTopDogOut | None)
async def public_top_dog(db: AsyncSession = Depends(get_db)):
    """The current Top Dog, if the crowned dog's share page is public."""
    winner_result = await db.execute(
        select(WeeklyWinner).order_by(WeeklyWinner.week_bucket.desc()).limit(1)
    )
    winner = winner_result.scalar_one_or_none()
    if not winner or winner.dog_id is None:
        return None

    dog_result = await db.execute(
        select(Dog)
        .options(selectinload(Dog.photos))
        .where(
            Dog.id == winner.dog_id,
            Dog.is_active == True,  # noqa: E712
            Dog.is_public == True,  # noqa: E712
        )
    )
    dog = dog_result.scalar_one_or_none()
    if not dog:
        return None

    return PublicTopDogOut(
        dog_id=dog.id,
        dog_name=dog.name,
        week_bucket=winner.week_bucket,
        score=winner.score,
        photo_url=display_photo_url(dog),
    )
