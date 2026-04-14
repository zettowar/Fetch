from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate, PostOut

router = APIRouter()


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_post(
    request: Request,
    body_data: PostCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    post = Post(
        author_id=user.id,
        kind=body_data.kind,
        title=body_data.title,
        body=body_data.body,
        tags=body_data.tags,
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
    query = select(Post).order_by(Post.pinned.desc(), Post.created_at.desc())
    if kind:
        query = query.where(Post.kind == kind)
    if tag:
        query = query.where(Post.tags.contains([tag]))
    if search:
        query = query.where(
            text("to_tsvector('english', title || ' ' || body) @@ plainto_tsquery('english', :q)")
        ).params(q=search)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return [
        PostOut(
            id=p.id, author_id=p.author_id, author_name=None,
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
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return PostOut(
        id=post.id, author_id=post.author_id, author_name=None,
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
