from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import STAFF_ROLES, get_current_user
from app.limiter import limiter
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate, PostOut
from app.services.blocks import blocked_user_ids_subquery, is_blocked_between

router = APIRouter()

MAX_TAGS = 5
MAX_TAG_LEN = 30


def _clean_tags(tags: list[str] | None) -> list[str] | None:
    """Normalise free-text tags: trimmed, lowercased, deduped, bounded.

    Tags are filtered on exactly (`Post.tags.contains`), so "Dogs" and "dogs "
    would otherwise be different facets and the filter list would fragment.
    """
    if not tags:
        return None
    seen: list[str] = []
    for raw in tags:
        t = " ".join(raw.split()).lower()[:MAX_TAG_LEN]
        if t and t not in seen:
            seen.append(t)
        if len(seen) >= MAX_TAGS:
            break
    return seen or None


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_post(
    request: Request,
    body_data: PostCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # `sponsor` and `rescue_spotlight` are editorial slots that render
    # differently from ordinary posts, so they are staff-only. The schema
    # validates the value is *known*; this decides who may use it.
    if body_data.kind != "community" and user.role not in STAFF_ROLES:
        raise HTTPException(
            status_code=403, detail="Only staff can create that kind of post"
        )

    post = Post(
        author_id=user.id,
        kind=body_data.kind,
        title=body_data.title,
        body=body_data.body,
        tags=_clean_tags(body_data.tags),
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return PostOut(
        id=post.id, author_id=post.author_id, author_name=user.display_name,
        kind=post.kind, title=post.title, body=post.body,
        tags=post.tags, pinned=post.pinned, created_at=post.created_at,
    )


@router.get("", response_model=list[PostOut])
async def list_posts(
    kind: str | None = Query(None),
    tag: str | None = Query(None),
    search: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Post)
        .options(selectinload(Post.author))
        # Blocks apply here as they do in the feed and comment list — otherwise
        # a blocked author's posts still reach the person who blocked them.
        .where(Post.author_id.notin_(blocked_user_ids_subquery(user.id)))
        .order_by(Post.pinned.desc(), Post.created_at.desc())
    )
    if kind:
        query = query.where(Post.kind == kind)
    if tag:
        query = query.where(Post.tags.contains([tag]))
    if search:
        # Query the indexed generated column so the GIN index is used.
        query = query.where(
            Post.search_vector.op("@@")(func.plainto_tsquery("english", search))
        )

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return [
        PostOut(
            id=p.id, author_id=p.author_id,
            author_name=p.author.display_name if p.author else None,
            kind=p.kind, title=p.title, body=p.body,
            tags=p.tags, pinned=p.pinned, created_at=p.created_at,
        )
        for p in result.scalars().all()
    ]


@router.get("/{post_id}", response_model=PostOut)
async def get_post(
    post_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post).options(selectinload(Post.author)).where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    # Same 404 the list filter implies — mirrors pets.get_pet.
    if await is_blocked_between(db, user.id, post.author_id):
        raise HTTPException(status_code=404, detail="Post not found")
    return PostOut(
        id=post.id, author_id=post.author_id,
        author_name=post.author.display_name if post.author else None,
        kind=post.kind, title=post.title, body=post.body,
        tags=post.tags, pinned=post.pinned, created_at=post.created_at,
    )


@router.delete("/{post_id}")
async def delete_post(
    post_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(post)
    await db.commit()
    return {"detail": "Post deleted"}
