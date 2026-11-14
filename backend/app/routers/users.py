from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError

from app.db import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.pet import Pet
from app.models.lost_report import LostReport
from app.models.social import Block, Follow
from app.schemas.user import BlockedUserOut, UserOut, UserUpdate

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
    if body.species_preference is not None:
        user.species_preference = body.species_preference
    await db.commit()
    await db.refresh(user)
    return user


# --- Blocking ---
# Static /me/blocks before the parameterized /{user_id}/block routes.

@router.get("/me/blocks", response_model=list[BlockedUserOut])
async def list_my_blocks(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Block, User.display_name)
        .join(User, User.id == Block.blocked_id)
        .where(Block.blocker_id == user.id)
        .order_by(Block.created_at.desc())
    )
    return [
        BlockedUserOut(
            user_id=block.blocked_id,
            display_name=display_name,
            blocked_at=block.created_at,
        )
        for block, display_name in result.all()
    ]


@router.post("/{user_id}/block", status_code=status.HTTP_201_CREATED)
async def block_user(
    user_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    target = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    db.add(Block(blocker_id=user.id, blocked_id=user_id))
    try:
        # Flush here, inside the handler. The bulk delete below autoflushes
        # the pending Block, so a repeat block used to raise uq_block from
        # that execute() — outside the try that only wrapped commit() — and
        # the "idempotent success" path was a 500.
        await db.flush()
    except IntegrityError:
        await db.rollback()  # already blocked — idempotent success
        return {"detail": "User blocked"}
    # Sever the follow graph both ways: neither side keeps a feed line into
    # the other.
    my_pets = select(Pet.id).where(Pet.owner_id == user.id)
    their_pets = select(Pet.id).where(Pet.owner_id == user_id)
    await db.execute(
        delete(Follow).where(
            or_(
                (Follow.follower_id == user.id) & (Follow.pet_id.in_(their_pets)),
                (Follow.follower_id == user_id) & (Follow.pet_id.in_(my_pets)),
            )
        )
    )
    await db.commit()
    return {"detail": "User blocked"}


@router.delete("/{user_id}/block")
async def unblock_user(
    user_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Block).where(Block.blocker_id == user.id, Block.blocked_id == user_id)
    )
    block = result.scalar_one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Not blocked")
    await db.delete(block)
    await db.commit()
    return {"detail": "User unblocked"}


@router.delete("/me")
async def delete_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == "admin":
        # Deactivation is only reversible by an admin. The last one closing
        # their own account would leave nobody able to reinstate anyone.
        other_admins = (
            await db.execute(
                select(func.count())
                .select_from(User)
                .where(
                    User.role == "admin",
                    User.is_active == True,  # noqa: E712
                    User.id != user.id,
                )
            )
        ).scalar() or 0
        if other_admins == 0:
            raise HTTPException(
                status_code=400,
                detail="You're the only admin. Promote another admin before closing this account.",
            )

    user.is_active = False
    # Deactivate all pets
    result = await db.execute(select(Pet).where(Pet.owner_id == user.id))
    for pet in result.scalars():
        pet.is_active = False
    # Take their lost/found reports down too. The public share page and the
    # sitemap key off the report alone, so without this a closed account kept
    # a public, indexable page carrying the pet's name, photo and area.
    await db.execute(
        update(LostReport)
        .where(LostReport.reporter_id == user.id)
        .values(is_public=False)
    )
    await db.execute(
        update(LostReport)
        .where(LostReport.reporter_id == user.id, LostReport.status == "open")
        .values(status="closed", resolved_at=datetime.now(timezone.utc))
    )
    await db.commit()
    return {"detail": "Account deactivated"}
