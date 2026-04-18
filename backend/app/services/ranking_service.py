import logging
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.models.dog import Dog
from app.models.vote import Vote
from app.models.weekly_winner import WeeklyWinner
from app.services.breed_display import breed_display
from app.services.feed_service import current_week_bucket

logger = logging.getLogger(__name__)


async def get_current_leaderboard(db: AsyncSession, limit: int = 20) -> list[dict]:
    week = current_week_bucket()
    query = (
        select(
            Vote.dog_id,
            func.sum(Vote.value).label("score"),
            func.count().label("total_votes"),
        )
        .where(Vote.week_bucket == week)
        .group_by(Vote.dog_id)
        .order_by(func.sum(Vote.value).desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    dog_ids = [row.dog_id for row in rows]
    dogs_by_id: dict = {}
    if dog_ids:
        dog_result = await db.execute(
            select(Dog).options(selectinload(Dog.breeds)).where(Dog.id.in_(dog_ids))
        )
        dogs_by_id = {d.id: d for d in dog_result.scalars().all()}

    leaderboard = []
    for rank, row in enumerate(rows, 1):
        dog = dogs_by_id.get(row.dog_id)
        if dog:
            leaderboard.append({
                "rank": rank,
                "dog_id": str(dog.id),
                "dog_name": dog.name,
                "breed": breed_display(dog.mix_type, dog.breeds),
                "score": row.score,
                "total_votes": row.total_votes,
            })

    return leaderboard


async def get_dog_stats(dog_id: UUID, db: AsyncSession) -> dict:
    likes = await db.execute(
        select(func.count()).where(Vote.dog_id == dog_id, Vote.value == 1)
    )
    passes = await db.execute(
        select(func.count()).where(Vote.dog_id == dog_id, Vote.value == -1)
    )
    return {
        "likes": likes.scalar() or 0,
        "passes": passes.scalar() or 0,
    }


async def compute_weekly_winner(db: AsyncSession) -> WeeklyWinner | None:
    last_week = current_week_bucket() - timedelta(days=7)

    # Check if already computed
    existing = await db.execute(
        select(WeeklyWinner).where(WeeklyWinner.week_bucket == last_week)
    )
    if existing.scalar_one_or_none():
        logger.info("Weekly winner for %s already computed", last_week)
        return None

    query = (
        select(Vote.dog_id, func.sum(Vote.value).label("score"))
        .where(Vote.week_bucket == last_week)
        .group_by(Vote.dog_id)
        .order_by(func.sum(Vote.value).desc())
        .limit(1)
    )
    result = await db.execute(query)
    row = result.first()

    if not row:
        logger.info("No votes found for week %s", last_week)
        return None

    winner = WeeklyWinner(
        week_bucket=last_week,
        dog_id=row.dog_id,
        score=row.score,
    )
    db.add(winner)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        logger.info("Weekly winner for %s already exists (race condition handled)", last_week)
        return None
    logger.info("Weekly winner for %s: dog %s with score %s", last_week, row.dog_id, row.score)
    return winner
