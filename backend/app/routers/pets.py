from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.models.breed import Breed
from app.models.pet import Pet
from app.models.user import User
from app.schemas.pet import PetCreate, PetOut, PetUpdate
from app.schemas.pet_trait import PetTraitOut
from app.schemas.photo import SetPrimaryPhotoRequest
from app.services.blocks import blocked_user_ids_subquery, is_blocked_between
from app.services.pet_serializer import pet_to_out as _pet_to_out, get_pet_full as _get_pet_full
from app.services.traits import list_trait_options, resolve_traits

router = APIRouter()


async def _fetch_breeds(breed_ids: list[UUID], db: AsyncSession, species: str) -> list[Breed]:
    if not breed_ids:
        return []
    # Breeds must match the pet's species — a cat can't be tagged a Labrador.
    result = await db.execute(
        select(Breed).where(
            Breed.id.in_(breed_ids),
            Breed.is_active == True,  # noqa: E712
            Breed.species == species,
        )
    )
    found = list(result.scalars().all())
    if len(found) != len(set(breed_ids)):
        raise HTTPException(
            status_code=400,
            detail="One or more breed_ids are invalid for this species",
        )
    return found


@router.post("", response_model=PetOut, status_code=status.HTTP_201_CREATED)
async def create_pet(
    body: PetCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    breeds = await _fetch_breeds(body.breed_ids, db, body.species)
    traits = await resolve_traits(db, body.traits, body.species, user.id)
    pet = Pet(
        owner_id=user.id,
        name=body.name,
        species=body.species,
        mix_type=body.mix_type,
        birthday=body.birthday,
        bio=body.bio,
        location_rough=body.location_rough,
        traits=traits,
    )
    pet.breeds = breeds
    db.add(pet)
    await db.commit()
    pet = await _get_pet_full(pet.id, db)
    return _pet_to_out(pet, viewer_id=user.id)


@router.get("/mine", response_model=list[PetOut])
async def list_my_pets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Pet)
        .options(
            selectinload(Pet.photos),
            selectinload(Pet.breeds),
            selectinload(Pet.owner).selectinload(User.rescue_profile),
        )
        .where(Pet.owner_id == user.id, Pet.is_active == True)
        .order_by(Pet.created_at.desc())
    )
    pets = result.scalars().all()
    return [_pet_to_out(d, viewer_id=user.id) for d in pets]


@router.get("/explore", response_model=list[PetOut])
async def explore_pets(
    limit: int = 24,
    exclude: str | None = None,
    species: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Random sample of active pets (excluding the current user's own).

    `exclude` is a comma-separated list of pet UUIDs the client has
    already seen — used by the "Explore the Pack" page to power infinite
    scroll without serving duplicates. Random order for now; will be
    replaced with a preference-based algorithm once user signals are
    richer.
    """
    limit = max(1, min(limit, 100))

    excluded_ids: list[UUID] = []
    if exclude:
        for raw in exclude.split(","):
            raw = raw.strip()
            if not raw:
                continue
            try:
                excluded_ids.append(UUID(raw))
            except ValueError:
                # Silently ignore malformed UUIDs — clients shouldn't be able
                # to break the feed with a bad cursor.
                continue

    where_clauses = [
        Pet.is_active == True,  # noqa: E712
        Pet.owner_id != user.id,
        Pet.adopted_at.is_(None),
        Pet.owner_id.notin_(blocked_user_ids_subquery(user.id)),
    ]
    if species in ("dog", "cat"):
        where_clauses.append(Pet.species == species)
    if excluded_ids:
        where_clauses.append(Pet.id.notin_(excluded_ids))

    result = await db.execute(
        select(Pet)
        .options(
            selectinload(Pet.photos),
            selectinload(Pet.breeds),
            selectinload(Pet.owner).selectinload(User.rescue_profile),
        )
        .where(*where_clauses)
        .order_by(func.random())
        .limit(limit)
    )
    return [_pet_to_out(d) for d in result.scalars().all()]


@router.get("/traits", response_model=list[PetTraitOut])
async def list_traits(
    species: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Approved personality traits offered as chips in the pet editor.

    Owners aren't limited to these — anything they type is accepted and queued
    for review (see `services/traits.py`). This is the suggestion list only.
    """
    return await list_trait_options(db, species)


@router.get("/by-user/{user_id}", response_model=list[PetOut])
async def list_pets_by_user(
    user_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List a user's public, active pets. Used by the user profile page."""
    # A block hides both sides' pets from each other — mirror the feed filter
    # so the profile page can't be used to sidestep it.
    if user_id != user.id and await is_blocked_between(db, user.id, user_id):
        return []
    result = await db.execute(
        select(Pet)
        .options(
            selectinload(Pet.photos),
            selectinload(Pet.breeds),
            selectinload(Pet.owner).selectinload(User.rescue_profile),
        )
        .where(Pet.owner_id == user_id, Pet.is_active == True)
        .order_by(Pet.created_at.desc())
    )
    return [_pet_to_out(d, viewer_id=user.id) for d in result.scalars().all()]


@router.get("/{pet_id}", response_model=PetOut)
async def get_pet(
    pet_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet = await _get_pet_full(pet_id, db)
    if not pet.is_active:
        raise HTTPException(status_code=404, detail="Pet not found")
    # Blocked users can't read each other's pets directly — same 404 the feed
    # gives, deliberately indistinguishable from a nonexistent pet.
    if pet.owner_id != user.id and await is_blocked_between(db, user.id, pet.owner_id):
        raise HTTPException(status_code=404, detail="Pet not found")
    return _pet_to_out(pet, viewer_id=user.id)


@router.patch("/{pet_id}", response_model=PetOut)
async def update_pet(
    pet_id: UUID,
    body: PetUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet = await _get_pet_full(pet_id, db)
    if pet.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your pet")

    update_data = body.model_dump(exclude_unset=True)
    new_breed_ids = update_data.pop("breed_ids", None)
    if update_data.get("traits") is not None:
        update_data["traits"] = await resolve_traits(
            db, update_data["traits"], pet.species, user.id
        )
    for field, value in update_data.items():
        setattr(pet, field, value)

    if new_breed_ids is not None:
        pet.breeds = await _fetch_breeds(new_breed_ids, db, pet.species)

    await db.commit()
    pet = await _get_pet_full(pet_id, db)
    return _pet_to_out(pet, viewer_id=user.id)


@router.delete("/{pet_id}")
async def delete_pet(
    pet_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet = await _get_pet_full(pet_id, db)
    if pet.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your pet")
    pet.is_active = False
    await db.commit()
    return {"detail": "Pet deactivated"}


@router.post("/{pet_id}/primary-photo", response_model=PetOut)
async def set_primary_photo(
    pet_id: UUID,
    body: SetPrimaryPhotoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pet = await _get_pet_full(pet_id, db)
    if pet.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your pet")

    photo = next((p for p in pet.photos if p.id == body.photo_id), None)
    if photo is None:
        raise HTTPException(status_code=400, detail="Photo does not belong to this pet")
    # Owners can see their in-review photos on their own page, but making one
    # primary would blank the pet's hero everywhere else until a reviewer acts.
    if photo.moderation_status != "approved":
        raise HTTPException(
            status_code=400, detail="That photo is still being reviewed"
        )

    pet.primary_photo_id = body.photo_id
    await db.commit()
    pet = await _get_pet_full(pet_id, db)
    return _pet_to_out(pet, viewer_id=user.id)
