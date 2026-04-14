from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.models.dog import Dog
from app.models.photo import Photo
from app.models.user import User
from app.models.weekly_winner import WeeklyWinner
from app.schemas.ranking import DogStats, LeaderboardEntry, WeeklyWinnerOut
from app.services.ranking_service import get_current_leaderboard, get_dog_stats
from app.storage import get_storage

router = APIRouter()


@router.get("/current", response_model=list[LeaderboardEntry])
async def current_rankings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_current_leaderboard(db)


@router.get("/winner/current", response_model=WeeklyWinnerOut | None)
async def current_winner(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WeeklyWinner).order_by(WeeklyWinner.week_bucket.desc()).limit(1)
    )
    winner = result.scalar_one_or_none()
    if not winner:
        return None

    dog_result = await db.execute(select(Dog).where(Dog.id == winner.dog_id))
    dog = dog_result.scalar_one_or_none()

    storage = get_storage()
    photo_url = None
    if dog and dog.primary_photo_id:
        photo_result = await db.execute(select(Photo).where(Photo.id == dog.primary_photo_id))
        photo = photo_result.scalar_one_or_none()
        if photo:
            photo_url = storage.url(photo.storage_key)

    return WeeklyWinnerOut(
        id=winner.id,
        week_bucket=winner.week_bucket,
        dog_id=winner.dog_id,
        dog_name=dog.name if dog else None,
        breed=dog.breed if dog else None,
        score=winner.score,
        primary_photo_url=photo_url,
        created_at=winner.created_at,
    )


@router.get("/history", response_model=list[WeeklyWinnerOut])
async def winner_history(
    limit: int = Query(12, ge=1, le=52),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WeeklyWinner).order_by(WeeklyWinner.week_bucket.desc()).limit(limit)
    )
    winners = result.scalars().all()

    if not winners:
        return []

    dog_ids = {w.dog_id for w in winners}
    dogs_result = await db.execute(select(Dog).where(Dog.id.in_(dog_ids)))
    dogs_by_id = {d.id: d for d in dogs_result.scalars().all()}

    photo_ids = {d.primary_photo_id for d in dogs_by_id.values() if d.primary_photo_id}
    photos_by_id: dict = {}
    if photo_ids:
        photos_result = await db.execute(select(Photo).where(Photo.id.in_(photo_ids)))
        photos_by_id = {p.id: p for p in photos_result.scalars().all()}

    storage = get_storage()
    out = []
    for w in winners:
        dog = dogs_by_id.get(w.dog_id)
        photo_url = None
        if dog and dog.primary_photo_id:
            photo = photos_by_id.get(dog.primary_photo_id)
            if photo:
                photo_url = storage.url(photo.storage_key)

        out.append(WeeklyWinnerOut(
            id=w.id,
            week_bucket=w.week_bucket,
            dog_id=w.dog_id,
            dog_name=dog.name if dog else None,
            breed=dog.breed if dog else None,
            score=w.score,
            primary_photo_url=photo_url,
            created_at=w.created_at,
        ))

    return out


@router.get("/dogs/{dog_id}/stats", response_model=DogStats)
async def dog_stats(
    dog_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_dog_stats(dog_id, db)
