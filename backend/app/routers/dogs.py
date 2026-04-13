from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.models.dog import Dog
from app.models.user import User
from app.schemas.dog import DogCreate, DogOut, DogUpdate
from app.schemas.photo import PhotoSummary, SetPrimaryPhotoRequest
from app.storage import get_storage

router = APIRouter()


def _dog_to_out(dog: Dog) -> DogOut:
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

    return DogOut(
        id=dog.id,
        owner_id=dog.owner_id,
        name=dog.name,
        breed=dog.breed,
        birthday=dog.birthday,
        bio=dog.bio,
        location_rough=dog.location_rough,
        traits=dog.traits or [],
        primary_photo_id=dog.primary_photo_id,
        primary_photo_url=primary_url,
        is_active=dog.is_active,
        created_at=dog.created_at,
        photos=photos_out,
    )


async def _get_dog_with_photos(dog_id: UUID, db: AsyncSession) -> Dog:
    result = await db.execute(
        select(Dog).options(selectinload(Dog.photos)).where(Dog.id == dog_id)
    )
    dog = result.scalar_one_or_none()
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found")
    return dog


@router.post("", response_model=DogOut, status_code=status.HTTP_201_CREATED)
async def create_dog(
    body: DogCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dog = Dog(owner_id=user.id, **body.model_dump())
    db.add(dog)
    await db.commit()
    # Re-fetch with photos eagerly loaded
    dog = await _get_dog_with_photos(dog.id, db)
    return _dog_to_out(dog)


@router.get("/mine", response_model=list[DogOut])
async def list_my_dogs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Dog)
        .options(selectinload(Dog.photos))
        .where(Dog.owner_id == user.id, Dog.is_active == True)
        .order_by(Dog.created_at.desc())
    )
    dogs = result.scalars().all()
    return [_dog_to_out(d) for d in dogs]


@router.get("/{dog_id}", response_model=DogOut)
async def get_dog(
    dog_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dog = await _get_dog_with_photos(dog_id, db)
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
    dog = await _get_dog_with_photos(dog_id, db)
    if dog.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your dog")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dog, field, value)

    await db.commit()
    dog = await _get_dog_with_photos(dog_id, db)
    return _dog_to_out(dog)


@router.delete("/{dog_id}")
async def delete_dog(
    dog_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dog = await _get_dog_with_photos(dog_id, db)
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
    dog = await _get_dog_with_photos(dog_id, db)
    if dog.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Not your dog")

    # Verify photo belongs to this dog
    photo_ids = {p.id for p in dog.photos}
    if body.photo_id not in photo_ids:
        raise HTTPException(status_code=400, detail="Photo does not belong to this dog")

    dog.primary_photo_id = body.photo_id
    await db.commit()
    dog = await _get_dog_with_photos(dog_id, db)
    return _dog_to_out(dog)
