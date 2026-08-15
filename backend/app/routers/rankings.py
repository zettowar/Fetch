from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.models.pet import Pet
from app.models.photo import Photo
from app.models.user import User
from app.models.weekly_winner import WeeklyWinner
from app.schemas.ranking import PetStats, LeaderboardEntry, WeeklyWinnerOut
from app.services.breed_display import breed_display
from app.services.ranking_service import (
    current_week_bucket,
    get_current_leaderboard,
    get_pet_stats,
)
from app.storage import get_storage

router = APIRouter()


@router.get("/current", response_model=list[LeaderboardEntry])
async def current_rankings(
    species: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_current_leaderboard(
        db, species=species if species in ("dog", "cat") else None
    )


@router.get("/winner/current", response_model=WeeklyWinnerOut | None)
async def current_winner(
    species: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Scope to the week in progress. Without this the newest row of *any* week
    # is served as "current", so a quiet week (or any Monday before the first
    # vote) presents a stale crown as this week's — and the client's
    # "No winner yet" state becomes unreachable once one winner has ever existed.
    q = select(WeeklyWinner).where(WeeklyWinner.week_bucket == current_week_bucket())
    if species in ("dog", "cat"):
        q = q.where(WeeklyWinner.species == species)
    result = await db.execute(q.order_by(WeeklyWinner.week_bucket.desc()).limit(1))
    winner = result.scalar_one_or_none()
    if not winner:
        return None

    pet_result = await db.execute(
        select(Pet).options(selectinload(Pet.breeds)).where(Pet.id == winner.pet_id)
    )
    pet = pet_result.scalar_one_or_none()

    storage = get_storage()
    photo_url = None
    if pet and pet.primary_photo_id:
        photo_result = await db.execute(
            select(Photo).where(
                Photo.id == pet.primary_photo_id,
                Photo.moderation_status == "approved",
            )
        )
        photo = photo_result.scalar_one_or_none()
        if photo:
            photo_url = storage.url(photo.storage_key)

    return WeeklyWinnerOut(
        id=winner.id,
        week_bucket=winner.week_bucket,
        species=winner.species,
        pet_id=winner.pet_id,
        pet_name=pet.name if pet else None,
        breed=breed_display(pet.mix_type, pet.breeds, pet.species) if pet else None,
        score=winner.score,
        primary_photo_url=photo_url,
        created_at=winner.created_at,
    )


@router.get("/history", response_model=list[WeeklyWinnerOut])
async def winner_history(
    limit: int = Query(12, ge=1, le=52),
    species: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(WeeklyWinner).order_by(WeeklyWinner.week_bucket.desc())
    if species in ("dog", "cat"):
        q = q.where(WeeklyWinner.species == species)
    result = await db.execute(q.limit(limit))
    winners = result.scalars().all()

    if not winners:
        return []

    pet_ids = {w.pet_id for w in winners}
    pets_result = await db.execute(
        select(Pet).options(selectinload(Pet.breeds)).where(Pet.id.in_(pet_ids))
    )
    pets_by_id = {d.id: d for d in pets_result.scalars().all()}

    photo_ids = {d.primary_photo_id for d in pets_by_id.values() if d.primary_photo_id}
    photos_by_id: dict = {}
    if photo_ids:
        photos_result = await db.execute(select(Photo).where(Photo.id.in_(photo_ids)))
        photos_by_id = {p.id: p for p in photos_result.scalars().all()}

    storage = get_storage()
    out = []
    for w in winners:
        pet = pets_by_id.get(w.pet_id)
        photo_url = None
        if pet and pet.primary_photo_id:
            photo = photos_by_id.get(pet.primary_photo_id)
            if photo:
                photo_url = storage.url(photo.storage_key)

        out.append(WeeklyWinnerOut(
            id=w.id,
            week_bucket=w.week_bucket,
            species=w.species,
            pet_id=w.pet_id,
            pet_name=pet.name if pet else None,
            breed=breed_display(pet.mix_type, pet.breeds, pet.species) if pet else None,
            score=w.score,
            primary_photo_url=photo_url,
            created_at=w.created_at,
        ))

    return out


@router.get("/pets/{pet_id}/stats", response_model=PetStats)
async def pet_stats(
    pet_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_pet_stats(pet_id, db)
