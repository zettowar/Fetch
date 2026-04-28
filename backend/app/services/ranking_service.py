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
    """Compute the prior week's winner (production weekly job).

    Skips if a winner row already exists for that week.
    """
    last_week = current_week_bucket() - timedelta(days=7)

    existing = await db.execute(
        select(WeeklyWinner).where(WeeklyWinner.week_bucket == last_week)
    )
    if existing.scalar_one_or_none():
        logger.info("Weekly winner for %s already computed", last_week)
        return None

    return await _pick_winner_for_week(db, last_week, upsert=False)


async def pick_current_winner(db: AsyncSession) -> WeeklyWinner | None:
    """Compute (or update) the *current* week's winner.

    Used by the troubleshooting 10-minute beat job so a winner appears as
    soon as anyone votes, and updates as the leaderboard shifts.
    """
    return await _pick_winner_for_week(db, current_week_bucket(), upsert=True)


async def _pick_winner_for_week(
    db: AsyncSession, week: date, *, upsert: bool
) -> WeeklyWinner | None:
    query = (
        select(Vote.dog_id, func.sum(Vote.value).label("score"))
        .where(Vote.week_bucket == week)
        .group_by(Vote.dog_id)
        .order_by(func.sum(Vote.value).desc())
        .limit(1)
    )
    result = await db.execute(query)
    row = result.first()

    if not row:
        logger.info("No votes found for week %s", week)
        return None

    if upsert:
        existing_q = await db.execute(
            select(WeeklyWinner).where(WeeklyWinner.week_bucket == week)
        )
        existing = existing_q.scalar_one_or_none()
        if existing:
            if existing.dog_id != row.dog_id or existing.score != row.score:
                existing.dog_id = row.dog_id
                existing.score = row.score
                await db.commit()
                logger.info(
                    "Updated winner for week %s: dog %s with score %s",
                    week,
                    row.dog_id,
                    row.score,
                )
            else:
                logger.info("Winner for week %s unchanged", week)
            return existing

    winner = WeeklyWinner(
        week_bucket=week,
        dog_id=row.dog_id,
        score=row.score,
    )
    db.add(winner)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        logger.info("Winner for week %s already exists (race condition handled)", week)
        return None
    logger.info("Winner for week %s: dog %s with score %s", week, row.dog_id, row.score)
    return winner
