from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.models.breed import Breed
from app.models.dog import Dog
from app.models.user import User
from app.schemas.dog import DogCreate, DogOut, DogUpdate
from app.schemas.photo import SetPrimaryPhotoRequest
from app.services.blocks import blocked_user_ids_subquery
from app.services.dog_serializer import dog_to_out as _dog_to_out, get_dog_full as _get_dog_full

router = APIRouter()


async def _fetch_breeds(breed_ids: list[UUID], db: AsyncSession) -> list[Breed]:
    if not breed_ids:
        return []
    result = await db.execute(
        select(Breed).where(Breed.id.in_(breed_ids), Breed.is_active == True)  # noqa: E712
    )
    found = list(result.scalars().all())
    if len(found) != len(set(breed_ids)):
        raise HTTPException(status_code=400, detail="One or more breed_ids are invalid")
    return found


@router.post("", response_model=DogOut, status_code=status.HTTP_201_CREATED)
async def create_dog(
    body: DogCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    breeds = await _fetch_breeds(body.breed_ids, db)
    dog = Dog(
        owner_id=user.id,
        name=body.name,
        mix_type=body.mix_type,
        birthday=body.birthday,
        bio=body.bio,
        location_rough=body.location_rough,
        traits=body.traits,
    )
    dog.breeds = breeds
    db.add(dog)
    await db.commit()
    dog = await _get_dog_full(dog.id, db)
    return _dog_to_out(dog)


@router.get("/mine", response_model=list[DogOut])
async def list_my_dogs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dog)
        .options(
            selectinload(Dog.photos),
            selectinload(Dog.breeds),
            selectinload(Dog.owner).selectinload(User.rescue_profile),
        )
        .where(Dog.owner_id == user.id, Dog.is_active == True)
        .order_by(Dog.created_at.desc())
    )
    dogs = result.scalars().all()
    return [_dog_to_out(d) for d in dogs]


@router.get("/explore", response_model=list[DogOut])
async def explore_dogs(
    limit: int = 24,
    exclude: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Random sample of active dogs (excluding the current user's own).

    `exclude` is a comma-separated list of dog UUIDs the client has
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
        Dog.is_active == True,  # noqa: E712
        Dog.owner_id != user.id,
        Dog.adopted_at.is_(None),
        Dog.owner_id.notin_(blocked_user_ids_subquery(user.id)),
    ]
    if excluded_ids:
        where_clauses.append(Dog.id.notin_(excluded_ids))

    result = await db.execute(
        select(Dog)
        .options(
            selectinload(Dog.photos),
            selectinload(Dog.breeds),
            selectinload(Dog.owner).selectinload(User.rescue_profile),
        )
        .where(*where_clauses)
        .order_by(func.random())
        .limit(limit)
    )
    return [_dog_to_out(d) for d in result.scalars().all()]


@router.get("/by-user/{user_id}", response_model=list[DogOut])
async def list_dogs_by_user(
    user_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List a user's public, active dogs. Used by the user profile page."""
    result = await db.execute(
        select(Dog)
        .options(
            selectinload(Dog.photos),
            selectinload(Dog.breeds),
            selectinload(Dog.owner).selectinload(User.rescue_profile),
        )
        .where(Dog.owner_id == user_id, Dog.is_active == True)
        .order_by(Dog.created_at.desc())
    )
    return [_dog_to_out(d) for d in result.scalars().all()]


@router.get("/{dog_id}", response_model=DogOut)
async def get_dog(
    dog_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dog = await _get_dog_full(dog_id, db)
    if not dog.is_active:
        raise HTTPException(status_code=404, detail="Dog not found")
    return _dog_to_out(dog)


@router.patch("/{dog_id}", response_model=DogOut)
async def update_dog(
    dog_id: UUID,
    body: DogUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dog = await _get_dog_full(dog_id, db)
    if dog.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your dog")

    update_data = body.model_dump(exclude_unset=True)
    new_breed_ids = update_data.pop("breed_ids", None)
    for field, value in update_data.items():
        setattr(dog, field, value)

    if new_breed_ids is not None:
        dog.breeds = await _fetch_breeds(new_breed_ids, db)

    await db.commit()
    dog = await _get_dog_full(dog_id, db)
    return _dog_to_out(dog)


@router.delete("/{dog_id}")
async def delete_dog(
    dog_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dog = await _get_dog_full(dog_id, db)
    if dog.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your dog")
    dog.is_active = False
    await db.commit()
    return {"detail": "Dog deactivated"}


@router.post("/{dog_id}/primary-photo", response_model=DogOut)
async def set_primary_photo(
    dog_id: UUID,
    body: SetPrimaryPhotoRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dog = await _get_dog_full(dog_id, db)
    if dog.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your dog")

    photo_ids = {p.id for p in dog.photos}
    if body.photo_id not in photo_ids:
        raise HTTPException(status_code=400, detail="Photo does not belong to this dog")

    dog.primary_photo_id = body.photo_id
    await db.commit()
    dog = await _get_dog_full(dog_id, db)
    return _dog_to_out(dog)
