from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.models.dog import Dog
from app.models.photo import Photo
from app.models.social import Comment, Follow, Reaction
from app.models.user import User
from app.schemas.social import (
    CommentCreate,
    CommentOut,
    FollowOut,
    FollowToggle,
    ReactionCounts,
    ReactionToggle,
    UserProfileOut,
)

router = APIRouter()


# --- Follows ---

@router.post("/follows", response_model=FollowOut, status_code=status.HTTP_201_CREATED)
async def follow_dog(
    body: FollowToggle,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify dog exists
    result = await db.execute(select(Dog).where(Dog.id == body.dog_id, Dog.is_active == True))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Dog not found")

    follow = Follow(follower_id=user.id, dog_id=body.dog_id)
    db.add(follow)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already following this dog")
    await db.refresh(follow)
    return follow


@router.delete("/follows/{dog_id}")
async def unfollow_dog(
    dog_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Follow).where(Follow.follower_id == user.id, Follow.dog_id == dog_id)
    )
    follow = result.scalar_one_or_none()
    if not follow:
        raise HTTPException(status_code=404, detail="Not following this dog")
    await db.delete(follow)
    await db.commit()
    return {"detail": "Unfollowed"}


@router.get("/follows/mine", response_model=list[FollowOut])
async def my_follows(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Follow).where(Follow.follower_id == user.id).order_by(Follow.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/dogs/{dog_id}/followers/count")
async def follower_count(
    dog_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count_result = await db.execute(
        select(func.count()).where(Follow.dog_id == dog_id)
    )
    count = count_result.scalar() or 0

    # Check if current user follows
    is_following_result = await db.execute(
        select(Follow).where(Follow.follower_id == user.id, Follow.dog_id == dog_id)
    )
    is_following = is_following_result.scalar_one_or_none() is not None

    return {"count": count, "is_following": is_following}


# --- Comments ---

@router.post("/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    body: CommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = Comment(
        author_id=user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        body=body.body,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return CommentOut(
        id=comment.id,
        author_id=comment.author_id,
        author_name=user.display_name,
        target_type=comment.target_type,
        target_id=comment.target_id,
        body=comment.body,
        created_at=comment.created_at,
    )


@router.get("/comments", response_model=list[CommentOut])
async def list_comments(
    target_type: str = Query(...),
    target_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.target_type == target_type, Comment.target_id == target_id)
        .order_by(Comment.created_at.asc())
        .limit(100)
    )
    comments = result.scalars().all()
    return [
        CommentOut(
            id=c.id,
            author_id=c.author_id,
            author_name=c.author.display_name if c.author else None,
            target_type=c.target_type,
            target_id=c.target_id,
            body=c.body,
            created_at=c.created_at,
        )
        for c in comments
    ]


@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != user.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    await db.delete(comment)
    await db.commit()
    return {"detail": "Comment deleted"}


# --- Reactions ---

@router.post("/reactions", response_model=ReactionCounts)
async def toggle_reaction(
    body: ReactionToggle,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check for existing reaction
    result = await db.execute(
        select(Reaction).where(
            Reaction.user_id == user.id,
            Reaction.target_type == body.target_type,
            Reaction.target_id == body.target_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        if existing.kind == body.kind:
            # Toggle off
            await db.delete(existing)
        else:
            # Change reaction type
            existing.kind = body.kind
    else:
        reaction = Reaction(
            user_id=user.id,
            target_type=body.target_type,
            target_id=body.target_id,
            kind=body.kind,
        )
        db.add(reaction)

    await db.commit()

    # Return updated counts
    return await _get_reaction_counts(db, body.target_type, body.target_id, user.id)


@router.get("/reactions", response_model=ReactionCounts)
async def get_reactions(
    target_type: str = Query(...),
    target_id: UUID = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_reaction_counts(db, target_type, target_id, user.id)


async def _get_reaction_counts(
    db: AsyncSession, target_type: str, target_id: UUID, user_id: UUID
) -> ReactionCounts:
    counts = {}
    for kind in ("like", "cute", "woof"):
        result = await db.execute(
            select(func.count()).where(
                Reaction.target_type == target_type,
                Reaction.target_id == target_id,
                Reaction.kind == kind,
            )
        )
        counts[kind] = result.scalar() or 0

    # Check user's reaction
    user_result = await db.execute(
        select(Reaction.kind).where(
            Reaction.user_id == user_id,
            Reaction.target_type == target_type,
            Reaction.target_id == target_id,
        )
    )
    user_row = user_result.first()

    return ReactionCounts(
        like=counts["like"],
        cute=counts["cute"],
        woof=counts["woof"],
        user_reaction=user_row[0] if user_row else None,
    )


# --- User Profiles ---

@router.get("/users/{user_id}/profile", response_model=UserProfileOut)
async def get_user_profile(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Dog count
    dog_count_result = await db.execute(
        select(func.count()).where(Dog.owner_id == user_id, Dog.is_active == True)
    )
    dog_count = dog_count_result.scalar() or 0

    # Follower count (total followers across all their dogs)
    follower_count_result = await db.execute(
        select(func.count(func.distinct(Follow.follower_id))).where(
            Follow.dog_id.in_(select(Dog.id).where(Dog.owner_id == user_id))
        )
    )
    follower_count = follower_count_result.scalar() or 0

    return UserProfileOut(
        id=target_user.id,
        display_name=target_user.display_name,
        location_rough=target_user.location_rough,
        created_at=target_user.created_at,
        dog_count=dog_count,
        follower_count=follower_count,
    )
