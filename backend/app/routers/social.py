from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.dog import Dog
from app.models.photo import Photo
from app.models.post import Post
from app.models.social import Comment, Follow, Reaction
from app.models.user import User
from app.services.blocks import is_blocked_between
from app.services.dog_serializer import dog_to_out as _dog_to_out
from app.services.notify import notify
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
@limiter.limit("60/minute")
async def follow_dog(
    request: Request,
    body: FollowToggle,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify dog exists
    result = await db.execute(select(Dog).where(Dog.id == body.dog_id, Dog.is_active == True))
    dog = result.scalar_one_or_none()
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found")
    if await is_blocked_between(db, user.id, dog.owner_id):
        # Indistinguishable from a nonexistent dog on purpose.
        raise HTTPException(status_code=404, detail="Dog not found")

    follow = Follow(follower_id=user.id, dog_id=body.dog_id)
    db.add(follow)
    # Flush BEFORE notify(): its preference lookup would autoflush the row
    # anyway, and a uq_follow violation must surface here as a clean 409.
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already following this dog")
    if dog.owner_id != user.id:
        await notify(
            db, dog.owner_id,
            type="follow",
            title=f"{user.display_name} started following {dog.name}",
            link=f"/app/dogs/{dog.id}",
        )
    await db.commit()
    await db.refresh(follow)
    return FollowOut(
        id=follow.id,
        follower_id=follow.follower_id,
        dog_id=follow.dog_id,
        created_at=follow.created_at,
        dog=None,
    )


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
        select(Follow)
        .options(
            selectinload(Follow.dog).selectinload(Dog.photos),
            selectinload(Follow.dog).selectinload(Dog.breeds),
            selectinload(Follow.dog).selectinload(Dog.owner).selectinload(User.rescue_profile),
        )
        .where(Follow.follower_id == user.id)
        .order_by(Follow.created_at.desc())
    )
    follows = list(result.scalars().all())
    return [
        FollowOut(
            id=f.id,
            follower_id=f.follower_id,
            dog_id=f.dog_id,
            created_at=f.created_at,
            dog=_dog_to_out(f.dog) if f.dog and f.dog.is_active else None,
        )
        for f in follows
    ]


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


_TARGET_MODELS = {"photo": Photo, "post": Post, "dog": Dog}


async def _require_target(db: AsyncSession, target_type: str, target_id: UUID) -> None:
    """404 unless the commented/reacted-on entity actually exists — otherwise
    arbitrary UUIDs accumulate orphan rows."""
    model = _TARGET_MODELS[target_type]
    exists = await db.execute(select(model.id).where(model.id == target_id))
    if exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail=f"{target_type} not found")


async def _comment_notification_context(
    db: AsyncSession, target_type: str, target_id: UUID
) -> tuple[UUID | None, str, str | None]:
    """Who to tell about a comment, plus display label and in-app link."""
    if target_type == "dog":
        dog = (await db.execute(select(Dog).where(Dog.id == target_id))).scalar_one_or_none()
        if dog:
            return dog.owner_id, dog.name, f"/app/dogs/{dog.id}"
    elif target_type == "photo":
        row = (
            await db.execute(
                select(Dog).join(Photo, Photo.dog_id == Dog.id).where(Photo.id == target_id)
            )
        ).scalar_one_or_none()
        if row:
            return row.owner_id, f"a photo of {row.name}", f"/app/dogs/{row.id}"
    elif target_type == "post":
        post = (await db.execute(select(Post).where(Post.id == target_id))).scalar_one_or_none()
        if post:
            return post.author_id, f"your post “{post.title[:60]}”", "/app/following"
    return None, "", None


# --- Comments ---

@router.post("/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
async def create_comment(
    request: Request,
    body: CommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_target(db, body.target_type, body.target_id)
    comment = Comment(
        author_id=user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        body=body.body,
    )
    db.add(comment)

    owner_id, label, link = await _comment_notification_context(
        db, body.target_type, body.target_id
    )
    if owner_id is not None and await is_blocked_between(db, user.id, owner_id):
        raise HTTPException(status_code=404, detail=f"{body.target_type} not found")
    if owner_id is not None and owner_id != user.id:
        excerpt = body.body if len(body.body) <= 120 else f"{body.body[:117]}..."
        await notify(
            db, owner_id,
            type="comment",
            title=f"{user.display_name} commented on {label}",
            body=excerpt,
            link=link,
        )

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
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.services.blocks import blocked_user_ids_subquery

    result = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(
            Comment.target_type == target_type,
            Comment.target_id == target_id,
            Comment.author_id.notin_(blocked_user_ids_subquery(user.id)),
        )
        .order_by(Comment.created_at.asc())
        .limit(limit)
        .offset(offset)
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
@limiter.limit("60/minute")
async def toggle_reaction(
    request: Request,
    body: ReactionToggle,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_target(db, body.target_type, body.target_id)
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
    rows = (await db.execute(
        select(Reaction.kind, func.count().label("c"))
        .where(
            Reaction.target_type == target_type,
            Reaction.target_id == target_id,
        )
        .group_by(Reaction.kind)
    )).all()
    by_kind = {kind: count for kind, count in rows}

    user_result = await db.execute(
        select(Reaction.kind).where(
            Reaction.user_id == user_id,
            Reaction.target_type == target_type,
            Reaction.target_id == target_id,
        )
    )
    user_row = user_result.first()

    return ReactionCounts(
        like=by_kind.get("like", 0),
        cute=by_kind.get("cute", 0),
        woof=by_kind.get("woof", 0),
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
