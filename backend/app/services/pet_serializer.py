"""Serialization for Pet -> PetOut, shared across routers.

Lives in services (not in a router) because feed, social, rescues and pets all
need it — importing a private helper across routers was hidden coupling.
"""
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import inspect as sa_inspect, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pet import Pet
from app.models.user import User
from app.schemas.breed import BreedSummary
from app.schemas.pet import PetOut
from app.schemas.photo import PhotoSummary
from app.services.breed_display import breed_display
from app.storage import get_storage


def _loaded(obj, attr: str) -> bool:
    """True if `attr` is already loaded on `obj` (no lazy DB hit needed).

    Async sessions can't lazy-load, so we must check rather than touch-and-pray.
    """
    return attr not in sa_inspect(obj).unloaded


def display_photo_url(pet: Pet | None) -> str | None:
    """URL of the pet's face photo for embedded payloads (check-ins, RSVPs,
    transfers, winner cards): the primary photo if it passed moderation, else
    the first approved photo. Requires pet.photos to be eager-loaded.
    """
    if pet is None or not _loaded(pet, "photos") or not pet.photos:
        return None
    approved = [p for p in pet.photos if p.moderation_status == "approved"]
    if not approved:
        return None
    storage = get_storage()
    if pet.primary_photo_id:
        for p in approved:
            if p.id == pet.primary_photo_id:
                return storage.url(p.storage_key)
    return storage.url(approved[0].storage_key)


def pet_to_out(
    pet: Pet,
    *,
    rescue_name: str | None = None,
    rescue_id: UUID | None = None,
    viewer_id: UUID | None = None,
) -> PetOut:
    """Serialize a Pet.

    `rescue_name` / `rescue_id` can be supplied by callers that already know the
    owning rescue (e.g. listing one rescue's pets). Otherwise we read
    `pet.owner.rescue_profile` *if it was eager-loaded* — callers that want
    adoption signals should
    `selectinload(Pet.owner).selectinload(User.rescue_profile)`.

    `viewer_id` opts into the owner's private view: their own photos still in
    moderation are included (badged, no `url`) so an upload awaiting review
    doesn't silently vanish. Leave it unset — the default — for any payload
    another user, the public share page, or the feed can see.
    """
    storage = get_storage()
    # Only surface photos that passed moderation. Anything flagged is withheld
    # from public payloads (the swipe feed already filters the same way).
    approved_photos = [p for p in pet.photos if p.moderation_status == "approved"]
    visible_photos = approved_photos
    if viewer_id is not None and viewer_id == pet.owner_id:
        # Approved first, so `photos[0]` stays the picture everyone else sees.
        visible_photos = approved_photos + [
            p for p in pet.photos if p.moderation_status != "approved"
        ]

    photos_out = []
    for p in visible_photos:
        po = PhotoSummary.model_validate(p)
        # In-review photos are withheld by the public file endpoint; the owner
        # fetches them through the authenticated per-photo route instead.
        po.url = storage.url(p.storage_key) if p.moderation_status == "approved" else None
        photos_out.append(po)

    primary_url = None
    if pet.primary_photo_id:
        for p in approved_photos:
            if p.id == pet.primary_photo_id:
                primary_url = storage.url(p.storage_key)
                break

    breeds_out = [BreedSummary.model_validate(b) for b in (pet.breeds or [])]

    # Infer rescue info + adoptability from the eager-loaded owner if the caller
    # didn't pass explicit values. Skip cleanly if the relationship isn't loaded.
    adoptable = False
    if (rescue_name is None or rescue_id is None) and _loaded(pet, "owner"):
        owner = pet.owner
        if owner is not None and _loaded(owner, "rescue_profile"):
            profile = owner.rescue_profile
            if profile and profile.status == "approved":
                rescue_name = rescue_name or profile.org_name
                rescue_id = rescue_id or profile.id
    if rescue_id is not None and pet.adopted_at is None and pet.is_active:
        adoptable = True

    return PetOut(
        id=pet.id,
        owner_id=pet.owner_id,
        name=pet.name,
        species=pet.species,
        mix_type=pet.mix_type,
        breeds=breeds_out,
        breed_display=breed_display(pet.mix_type, pet.breeds, pet.species),
        birthday=pet.birthday,
        bio=pet.bio,
        location_rough=pet.location_rough,
        traits=pet.traits or [],
        primary_photo_id=pet.primary_photo_id,
        primary_photo_url=primary_url,
        is_active=pet.is_active,
        is_public=pet.is_public,
        created_at=pet.created_at,
        photos=photos_out,
        adoptable=adoptable,
        adopted_at=pet.adopted_at,
        rescue_name=rescue_name,
        rescue_id=rescue_id,
    )


async def get_pet_full(pet_id: UUID, db: AsyncSession) -> Pet:
    """Load a pet with the full set of relationships used by `pet_to_out`."""
    result = await db.execute(
        select(Pet)
        .options(
            selectinload(Pet.photos),
            selectinload(Pet.breeds),
            selectinload(Pet.owner).selectinload(User.rescue_profile),
        )
        .where(Pet.id == pet_id)
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    return pet
