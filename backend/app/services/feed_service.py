from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pet import Pet
from app.models.photo import Photo
from app.models.vote import Vote


def current_week_bucket(now: datetime | None = None) -> date:
    now = now or datetime.now(timezone.utc)
    iso = now.isocalendar()
    return date.fromisocalendar(iso.year, iso.week, 1)  # Monday


async def get_feed(
    user_id: UUID, db: AsyncSession, limit: int = 10, species: str | None = None
) -> list[Pet]:
    week = current_week_bucket()

    # Subquery: pets already voted on this week
    voted_subq = (
        select(Vote.pet_id)
        .where(Vote.voter_id == user_id, Vote.week_bucket == week)
        .scalar_subquery()
    )

    # Subquery: count votes this week per pet (for exploration bias)
    vote_count_subq = (
        select(Vote.pet_id, func.count().label("vote_count"))
        .where(Vote.week_bucket == week)
        .group_by(Vote.pet_id)
        .subquery()
    )

    # Dogs with at least one approved photo
    has_photo_subq = (
        select(Photo.pet_id)
        .where(Photo.moderation_status == "approved")
        .distinct()
        .scalar_subquery()
    )

    # Weighted shuffle: random() * (1 + vote_count). Less-voted pets still get
    # an exploration boost, but order is not deterministic between sessions so
    # repeat visitors see meaningfully different decks.
    vote_count_expr = func.coalesce(vote_count_subq.c.vote_count, 0)
    from app.services.blocks import blocked_user_ids_subquery

    conditions = [
        Pet.is_active == True,
        Pet.owner_id != user_id,
        Pet.id.notin_(voted_subq),
        Pet.id.in_(has_photo_subq),
        Pet.adopted_at.is_(None),
        Pet.owner_id.notin_(blocked_user_ids_subquery(user_id)),
    ]
    # species=None means a mixed deck (the "All" filter); dog/cat scopes it.
    if species:
        conditions.append(Pet.species == species)

    query = (
        select(Pet)
        .outerjoin(vote_count_subq, Pet.id == vote_count_subq.c.pet_id)
        .where(*conditions)
        .order_by((func.random() * (1 + vote_count_expr)).asc())
        .limit(limit)
    )

    result = await db.execute(query)
    return list(result.scalars().all())
