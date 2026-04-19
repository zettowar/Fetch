from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.report import Report
from app.models.user import User
from app.schemas.report import ReportCreate, ReportOut

router = APIRouter()

MAX_REPORTS_PER_USER_PER_DAY = 10


@router.get("/mine", response_model=list[ReportOut])
async def my_reports(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Report)
        .where(Report.reporter_id == user.id)
        .order_by(Report.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/hour")
async def create_report(
    request: Request,
    body: ReportCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Prevent self-reporting abuse
    if body.target_type == "user" and body.target_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    # Check for duplicate report
    existing = await db.execute(
        select(Report).where(
            Report.reporter_id == user.id,
            Report.target_type == body.target_type,
            Report.target_id == body.target_id,
            Report.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already have a pending report for this")

    report = Report(
        reporter_id=user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        reason=body.reason,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report
