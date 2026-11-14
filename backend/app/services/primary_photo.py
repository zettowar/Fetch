"""Keeping `pets.primary_photo_id` pointed at a photo people can actually see."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pet import Pet
from app.models.photo import Photo


async def reassign_primary_photo(db: AsyncSession, pet: Pet, removed_photo_id: UUID) -> None:
    """Hand the primary slot on when the photo holding it is being removed.

    Deleting or rejecting a pet's primary photo used to just null the slot.
    The pet's other approved photos were still there, but nothing promoted one,
    so the hero image, the swipe card and the winner cards — all of which read
    the primary — went blank until the owner noticed and picked one by hand.

    The successor is the next *approved* photo in gallery order; a photo held
    by moderation can never be primary (see CLAUDE.md, photo moderation).
    A no-op when `removed_photo_id` isn't the current primary.
    """
    if pet.primary_photo_id != removed_photo_id:
        return
    successor = (
        await db.execute(
            select(Photo.id)
            .where(
                Photo.pet_id == pet.id,
                Photo.id != removed_photo_id,
                Photo.moderation_status == "approved",
            )
            .order_by(Photo.sort_order.asc(), Photo.created_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    pet.primary_photo_id = successor
