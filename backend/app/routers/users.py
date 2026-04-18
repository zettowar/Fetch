from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.dog import Dog
from app.schemas.user import UserOut, UserUpdate

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.location_rough is not None:
        user.location_rough = body.location_rough
    if body.date_of_birth is not None:
        user.date_of_birth = body.date_of_birth
    if body.show_adoption_prompt is not None:
        user.show_adoption_prompt = body.show_adoption_prompt
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/me")
async def delete_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user.is_active = False
    # Deactivate all dogs
    result = await db.execute(select(Dog).where(Dog.owner_id == user.id))
    for dog in result.scalars():
        dog.is_active = False
    await db.commit()
    return {"detail": "Account deactivated"}
