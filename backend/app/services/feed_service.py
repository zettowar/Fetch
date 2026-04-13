from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dog import Dog
from app.models.photo import Photo
from app.models.vote import Vote


def current_week_bucket(now: datetime | None = None) -> date:
    now = now or datetime.now(timezone.utc)
    iso = now.isocalendar()
    return date.fromisocalendar(iso.year, iso.week, 1)  # Monday


async def get_feed(
    user_id: UUID, db: AsyncSession, limit: int = 10
) -> list[Dog]:
    week = current_week_bucket()

    # Subquery: dogs already voted on this week
    voted_subq = (
        select(Vote.dog_id)
        .where(Vote.voter_id == user_id, Vote.week_bucket == week)
        .scalar_subquery()
    )

    # Subquery: count votes this week per dog (for exploration bias)
    vote_count_subq = (
        select(Vote.dog_id, func.count().label("vote_count"))
        .where(Vote.week_bucket == week)
        .group_by(Vote.dog_id)
        .subquery()
    )

    # Dogs with at least one approved photo
    has_photo_subq = (
        select(Photo.dog_id)
        .where(Photo.moderation_status == "approved")
        .distinct()
        .scalar_subquery()
    )

    query = (
        select(Dog)
        .outerjoin(vote_count_subq, Dog.id == vote_count_subq.c.dog_id)
        .where(
            Dog.is_active == True,
            Dog.owner_id != user_id,
            Dog.id.notin_(voted_subq),
            Dog.id.in_(has_photo_subq),
        )
        .order_by(
            func.coalesce(vote_count_subq.c.vote_count, 0).asc(),
            func.random(),
        )
        .limit(limit)
    )

    result = await db.execute(query)
    return list(result.scalars().all())
