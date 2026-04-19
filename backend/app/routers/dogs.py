from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.models.breed import Breed
from app.models.dog import Dog
from app.models.rescue import RescueProfile
from app.models.user import User
from app.schemas.breed import BreedSummary
from app.schemas.dog import DogCreate, DogOut, DogUpdate
from app.schemas.photo import PhotoSummary, SetPrimaryPhotoRequest
from app.services.breed_display import breed_display
from app.storage import get_storage

router = APIRouter()


def _dog_to_out(
    dog: Dog,
    *,
    rescue_name: str | None = None,
    rescue_id: UUID | None = None,
) -> DogOut:
    """Serialize a Dog.

    `rescue_name` / `rescue_id` can be supplied by callers that already
    know the owning rescue (e.g. listing one rescue's dogs). Otherwise,
    we try to read `dog.owner.rescue_profile` if it was eager-loaded —
    callers that want adoption signals in their payload should
    `selectinload(Dog.owner).selectinload(User.rescue_profile)`.
    """
    storage = get_storage()
    photos_out = []
    for p in dog.photos:
        po = PhotoSummary.model_validate(p)
        po.url = storage.url(p.storage_key)
        photos_out.append(po)

    primary_url = None
    if dog.primary_photo_id:
        for p in dog.photos:
            if p.id == dog.primary_photo_id:
                primary_url = storage.url(p.storage_key)
                break

    breeds_out = [BreedSummary.model_validate(b) for b in (dog.breeds or [])]

    # Infer rescue info + adoptability from eager-loaded owner if the caller
    # didn't pass explicit values. Safe to skip if the relationship isn't loaded.
    adoptable = False
    if rescue_name is None or rescue_id is None:
        try:
            owner = dog.owner  # noqa: SLF001
        except Exception:
            owner = None
        if owner is not None:
            try:
                profile = owner.rescue_profile
            except Exception:
                profile = None
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


async def _get_dog_full(dog_id: UUID, db: AsyncSession) -> Dog:
    """Load a dog with the full set of relationships used by `_dog_to_out`."""
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
