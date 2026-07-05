"""Beta feedback and invite code management."""
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_admin
from app.limiter import limiter
from app.models.audit_log import AuditLog
from app.models.beta import Feedback, InviteCode
from app.models.user import User
from app.schemas.beta import FeedbackCreate, FeedbackOut, InviteCodeBatchCreate, InviteCodeOut

router = APIRouter()


@router.post("/feedback", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/hour")
async def submit_feedback(
    request: Request,
    body_data: FeedbackCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    fb = Feedback(
        user_id=user.id,
        screen_name=body_data.screen_name,
        body=body_data.body,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(fb)
    await db.commit()
    await db.refresh(fb)
    return fb


@router.get("/feedback", response_model=list[FeedbackOut])
async def list_feedback(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Feedback).order_by(Feedback.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


@router.post(
    "/invites/generate",
    response_model=list[InviteCodeOut],
    status_code=status.HTTP_201_CREATED,
)
async def generate_invite_codes(
    body: InviteCodeBatchCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    codes = []
    for _ in range(min(body.count, 100)):
        code = InviteCode(
            code=f"FETCH-{secrets.token_hex(4).upper()}",
            created_by=admin.id,
        )
        db.add(code)
        codes.append(code)

    db.add(AuditLog(
        actor_id=admin.id,
        action="invite.generate",
        target_type="invite",
        metadata_={"count": len(codes)},
    ))
    await db.commit()
    for c in codes:
        await db.refresh(c)
    return codes


# --- Member invites ---
# Every member can mint a small lifetime allowance of codes for friends —
# the beta grows through the social graph instead of an admin bottleneck.

@router.get("/invites/mine", response_model=list[InviteCodeOut])
async def my_invite_codes(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InviteCode)
        .where(InviteCode.created_by == user.id)
        .order_by(InviteCode.created_at.asc())
    )
    return list(result.scalars().all())


@router.post(
    "/invites/mine/generate",
    response_model=list[InviteCodeOut],
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/hour")
async def generate_my_invite_codes(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mint the remainder of the caller's invite allowance."""
    from sqlalchemy import func

    if settings.MEMBER_INVITE_ALLOWANCE <= 0:
        raise HTTPException(status_code=403, detail="Member invites are not enabled")

    existing = (
        await db.execute(
            select(func.count()).select_from(InviteCode).where(InviteCode.created_by == user.id)
        )
    ).scalar() or 0
    remaining = settings.MEMBER_INVITE_ALLOWANCE - existing
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="You've used your invite allowance")

    codes = []
    for _ in range(remaining):
        code = InviteCode(
            code=f"FETCH-{secrets.token_hex(4).upper()}",
            created_by=user.id,
        )
        db.add(code)
        codes.append(code)
    await db.commit()
    for c in codes:
        await db.refresh(c)
    return codes


@router.get("/invites", response_model=list[InviteCodeOut])
async def list_invite_codes(
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InviteCode).order_by(InviteCode.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())
