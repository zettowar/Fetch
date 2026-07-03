"""Serialization for Dog -> DogOut, shared across routers.

Lives in services (not in a router) because feed, social, rescues and dogs all
need it — importing a private helper across routers was hidden coupling.
"""
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import inspect as sa_inspect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dog import Dog
from app.models.user import User
from app.schemas.breed import BreedSummary
from app.schemas.dog import DogOut
from app.schemas.photo import PhotoSummary
from app.services.breed_display import breed_display
from app.storage import get_storage


def _loaded(obj, attr: str) -> bool:
    """True if `attr` is already loaded on `obj` (no lazy DB hit needed).

    Async sessions can't lazy-load, so we must check rather than touch-and-pray.
    """
    return attr not in sa_inspect(obj).unloaded


def display_photo_url(dog: Dog | None) -> str | None:
    """URL of the dog's face photo for embedded payloads (check-ins, RSVPs,
    transfers, winner cards): the primary photo if it passed moderation, else
    the first approved photo. Requires dog.photos to be eager-loaded.
    """
    if dog is None or not _loaded(dog, "photos") or not dog.photos:
        return None
    approved = [p for p in dog.photos if p.moderation_status == "approved"]
    if not approved:
        return None
    storage = get_storage()
    if dog.primary_photo_id:
        for p in approved:
            if p.id == dog.primary_photo_id:
                return storage.url(p.storage_key)
    return storage.url(approved[0].storage_key)


def dog_to_out(
    dog: Dog,
    *,
    rescue_name: str | None = None,
    rescue_id: UUID | None = None,
) -> DogOut:
    """Serialize a Dog.

    `rescue_name` / `rescue_id` can be supplied by callers that already know the
    owning rescue (e.g. listing one rescue's dogs). Otherwise we read
    `dog.owner.rescue_profile` *if it was eager-loaded* — callers that want
    adoption signals should
    `selectinload(Dog.owner).selectinload(User.rescue_profile)`.
    """
    storage = get_storage()
    # Only surface photos that passed moderation. Anything flagged is withheld
    # from public payloads (the swipe feed already filters the same way).
    approved_photos = [p for p in dog.photos if p.moderation_status == "approved"]
    photos_out = []
    for p in approved_photos:
        po = PhotoSummary.model_validate(p)
        po.url = storage.url(p.storage_key)
        photos_out.append(po)

    primary_url = None
    if dog.primary_photo_id:
        for p in approved_photos:
            if p.id == dog.primary_photo_id:
                primary_url = storage.url(p.storage_key)
                break

    breeds_out = [BreedSummary.model_validate(b) for b in (dog.breeds or [])]

    # Infer rescue info + adoptability from the eager-loaded owner if the caller
    # didn't pass explicit values. Skip cleanly if the relationship isn't loaded.
    adoptable = False
    if (rescue_name is None or rescue_id is None) and _loaded(dog, "owner"):
        owner = dog.owner
        if owner is not None and _loaded(owner, "rescue_profile"):
            profile = owner.rescue_profile
            if profile and profile.status == "approved":
                rescue_name = rescue_name or profile.org_name
                rescue_id = rescue_id or profile.id
    if rescue_id is not None and dog.adopted_at is None and dog.is_active:
        adoptable = True

    return DogOut(
        id=dog.id,
        owner_id=dog.owner_id,
        name=dog.name,
        mix_type=dog.mix_type,
        breeds=breeds_out,
        breed_display=breed_display(dog.mix_type, dog.breeds),
        birthday=dog.birthday,
        bio=dog.bio,
        location_rough=dog.location_rough,
        traits=dog.traits or [],
        primary_photo_id=dog.primary_photo_id,
        primary_photo_url=primary_url,
        is_active=dog.is_active,
        created_at=dog.created_at,
        photos=photos_out,
        adoptable=adoptable,
        adopted_at=dog.adopted_at,
        rescue_name=rescue_name,
        rescue_id=rescue_id,
    )


async def get_dog_full(dog_id: UUID, db: AsyncSession) -> Dog:
    """Load a dog with the full set of relationships used by `dog_to_out`."""
    result = await db.execute(
        select(Dog)
        .options(
            selectinload(Dog.photos),
            selectinload(Dog.breeds),
            selectinload(Dog.owner).selectinload(User.rescue_profile),
        )
        .where(Dog.id == dog_id)
    )
    dog = result.scalar_one_or_none()
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found")
    return dog
