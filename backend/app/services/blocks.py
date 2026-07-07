"""Block-list helpers shared by the feed, social, and relay paths.

A block is symmetric in effect: neither side sees the other's pets in
feeds, can follow or comment, or can reach the other through the lost-pet
contact relay.
"""
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.social import Block


def blocked_user_ids_subquery(viewer_id: UUID):
    """Subquery of user ids blocked by, or blocking, the viewer — usable in
    `Pet.owner_id.notin_(...)` filters without an extra round trip."""
    return (
        select(Block.blocked_id)
        .where(Block.blocker_id == viewer_id)
        .union(
            select(Block.blocker_id).where(Block.blocked_id == viewer_id)
        )
    )


async def is_blocked_between(db: AsyncSession, a: UUID, b: UUID) -> bool:
    result = await db.execute(
        select(Block.id).where(
            or_(
                (Block.blocker_id == a) & (Block.blocked_id == b),
                (Block.blocker_id == b) & (Block.blocked_id == a),
            )
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None
