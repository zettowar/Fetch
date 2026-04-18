from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.db import get_db
from app.deps import get_current_user
from app.models.dog import Dog
from app.models.user import User
from app.schemas.dog import DogOut
from app.services.feed_service import get_feed
from app.routers.dogs import _dog_to_out

router = APIRouter()


@router.get("/next", response_model=list[DogOut])
async def get_feed_next(
    limit: int = Query(10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    dogs = await get_feed(user.id, db, limit=limit)

    # Eagerly load photos for each dog
    if dogs:
        dog_ids = [d.id for d in dogs]
        result = await db.execute(
            select(Dog)
            .options(
                selectinload(Dog.photos),
                selectinload(Dog.breeds),
                selectinload(Dog.owner).selectinload(User.rescue_profile),
            )
            .where(Dog.id.in_(dog_ids))
        )
        dogs_with_photos = result.scalars().all()
        return [_dog_to_out(d) for d in dogs_with_photos]

    return []
