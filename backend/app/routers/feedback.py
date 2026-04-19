"""Beta feedback and invite code management."""
import secrets

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Feedback).order_by(Feedback.created_at.desc()).limit(100)
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


@router.get("/invites", response_model=list[InviteCodeOut])
async def list_invite_codes(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InviteCode).order_by(InviteCode.created_at.desc()).limit(200)
    )
    return list(result.scalars().all())
