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
from app.schemas.photo import SetPrimaryPhotoRequest
from app.services.blocks import blocked_user_ids_subquery, is_blocked_between
from app.services.pet_serializer import pet_to_out as _pet_to_out, get_pet_full as _get_pet_full

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
    pet = Pet(
        owner_id=user.id,
        name=body.name,
        species=body.species,
        mix_type=body.mix_type,
        birthday=body.birthday,
        bio=body.bio,
        location_rough=body.location_rough,
        traits=body.traits,
    )
    pet.breeds = breeds
    db.add(pet)
    await db.commit()
    pet = await _get_pet_full(pet.id, db)
    return _pet_to_out(pet)


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
    return [_pet_to_out(d) for d in pets]


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
    return [_pet_to_out(d) for d in result.scalars().all()]


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
    return _pet_to_out(pet)


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
    for field, value in update_data.items():
        setattr(pet, field, value)

    if new_breed_ids is not None:
        pet.breeds = await _fetch_breeds(new_breed_ids, db, pet.species)

    await db.commit()
    pet = await _get_pet_full(pet_id, db)
    return _pet_to_out(pet)


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

    photo_ids = {p.id for p in pet.photos}
    if body.photo_id not in photo_ids:
        raise HTTPException(status_code=400, detail="Photo does not belong to this pet")

    pet.primary_photo_id = body.photo_id
    await db.commit()
    pet = await _get_pet_full(pet_id, db)
    return _pet_to_out(pet)
