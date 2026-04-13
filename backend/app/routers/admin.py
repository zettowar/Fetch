from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_admin
from app.models.beta import Feedback, InviteCode
from app.models.dog import Dog
from app.models.report import Report, Strike
from app.models.rescue import Rescue
from app.models.support import FAQEntry, SupportTicket
from app.models.user import User
from app.schemas.admin import AdminUserOut, DashboardStats, FAQCreate, FAQUpdate, TicketStatusUpdate
from app.schemas.report import ReportOut, ReportReview, StrikeOut
from app.schemas.support import FAQOut, TicketOut

router = APIRouter()

STRIKE_THRESHOLD = 3


# --- Dashboard ---

@router.get("/stats", response_model=DashboardStats)
async def dashboard_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    active_users = (await db.execute(select(func.count()).where(User.is_active == True))).scalar() or 0
    suspended_users = (await db.execute(select(func.count()).where(User.is_active == False))).scalar() or 0
    users_7d = (await db.execute(select(func.count()).where(User.created_at >= week_ago))).scalar() or 0
    total_dogs = (await db.execute(select(func.count()).select_from(Dog))).scalar() or 0
    pending_reports = (await db.execute(select(func.count()).where(Report.status == "pending"))).scalar() or 0
    open_tickets = (await db.execute(select(func.count()).where(SupportTicket.status == "open"))).scalar() or 0
    unverified_rescues = (await db.execute(select(func.count()).where(Rescue.verified == False))).scalar() or 0
    unused_invites = (await db.execute(select(func.count()).where(InviteCode.is_used == False))).scalar() or 0
    total_feedback = (await db.execute(select(func.count()).select_from(Feedback))).scalar() or 0
    reports_7d = (await db.execute(select(func.count()).where(Report.created_at >= week_ago))).scalar() or 0

    # Oldest pending items (SLA tracking)
    oldest_report_result = await db.execute(
        select(func.min(Report.created_at)).where(Report.status == "pending")
    )
    oldest_report_time = oldest_report_result.scalar()
    oldest_report_hours = (
        round((now - oldest_report_time).total_seconds() / 3600, 1)
        if oldest_report_time else None
    )

    oldest_ticket_result = await db.execute(
        select(func.min(SupportTicket.created_at)).where(SupportTicket.status == "open")
    )
    oldest_ticket_time = oldest_ticket_result.scalar()
    oldest_ticket_hours = (
        round((now - oldest_ticket_time).total_seconds() / 3600, 1)
        if oldest_ticket_time else None
    )

    return DashboardStats(
        total_users=total_users,
        active_users=active_users,
        suspended_users=suspended_users,
        users_last_7d=users_7d,
        total_dogs=total_dogs,
        pending_reports=pending_reports,
        open_tickets=open_tickets,
        unverified_rescues=unverified_rescues,
        unused_invites=unused_invites,
        total_feedback=total_feedback,
        reports_last_7d=reports_7d,
        oldest_pending_report_hours=oldest_report_hours,
        oldest_open_ticket_hours=oldest_ticket_hours,
    )


# --- User Management ---

@router.get("/users/search", response_model=list[AdminUserOut])
async def search_users(
    q: str = Query(..., min_length=1),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(User)
        .where(
            or_(
                User.email.ilike(f"%{q}%"),
                User.display_name.ilike(f"%{q}%"),
            )
        )
        .order_by(User.created_at.desc())
        .limit(50)
    )
    result = await db.execute(query)
    users = result.scalars().all()

    out = []
    for u in users:
        dog_count = (await db.execute(select(func.count()).where(Dog.owner_id == u.id))).scalar() or 0
        strike_count = (await db.execute(select(func.count()).where(Strike.user_id == u.id))).scalar() or 0
        out.append(AdminUserOut(
            id=u.id, email=u.email, display_name=u.display_name,
            location_rough=u.location_rough, is_active=u.is_active,
            is_verified=u.is_verified, role=u.role, created_at=u.created_at,
            dog_count=dog_count, strike_count=strike_count,
        ))
    return out


@router.get("/users/{user_id}", response_model=AdminUserOut)
async def get_user_detail(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    dog_count = (await db.execute(select(func.count()).where(Dog.owner_id == u.id))).scalar() or 0
    strike_count = (await db.execute(select(func.count()).where(Strike.user_id == u.id))).scalar() or 0

    return AdminUserOut(
        id=u.id, email=u.email, display_name=u.display_name,
        location_rough=u.location_rough, is_active=u.is_active,
        is_verified=u.is_verified, role=u.role, created_at=u.created_at,
        dog_count=dog_count, strike_count=strike_count,
    )


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
    return {"detail": "User suspended"}


@router.post("/users/{user_id}/reinstate")
async def reinstate_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    await db.commit()
    return {"detail": "User reinstated"}


# --- Reports ---

@router.get("/reports", response_model=list[ReportOut])
async def list_reports(
    status_filter: str = Query("pending"),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Report).order_by(Report.created_at.desc()).limit(100)
    if status_filter != "all":
        query = query.where(Report.status == status_filter)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/reports/{report_id}/review", response_model=ReportOut)
async def review_report(
    report_id: UUID,
    body: ReportReview,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != "pending":
        raise HTTPException(status_code=400, detail="Report already reviewed")

    report.status = body.status
    report.admin_notes = body.admin_notes
    report.reviewed_by = admin.id

    if body.apply_strike and body.status == "reviewed":
        target_user_id = await _resolve_target_user(report, db)
        if target_user_id:
            strike = Strike(
                user_id=target_user_id,
                report_id=report.id,
                reason=body.strike_reason or report.reason,
            )
            db.add(strike)

            count_result = await db.execute(
                select(func.count()).where(Strike.user_id == target_user_id)
            )
            strike_count = (count_result.scalar() or 0) + 1
            if strike_count >= STRIKE_THRESHOLD:
                user_result = await db.execute(select(User).where(User.id == target_user_id))
                target_user = user_result.scalar_one_or_none()
                if target_user:
                    target_user.is_active = False

    await db.commit()
    await db.refresh(report)
    return report


@router.get("/strikes/{user_id}", response_model=list[StrikeOut])
async def get_user_strikes(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Strike).where(Strike.user_id == user_id).order_by(Strike.created_at.desc())
    )
    return list(result.scalars().all())


# --- Tickets ---

@router.post("/tickets/{ticket_id}/update", response_model=TicketOut)
async def update_ticket(
    ticket_id: UUID,
    body: TicketStatusUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.status = body.status
    ticket.assigned_to = admin.id
    await db.commit()
    await db.refresh(ticket)
    return ticket


# --- FAQ Management ---

@router.post("/faq", response_model=FAQOut, status_code=201)
async def create_faq(
    body: FAQCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    entry = FAQEntry(
        question=body.question,
        answer=body.answer,
        category=body.category,
        sort_order=body.sort_order,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/faq/{faq_id}", response_model=FAQOut)
async def update_faq(
    faq_id: UUID,
    body: FAQUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FAQEntry).where(FAQEntry.id == faq_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="FAQ entry not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/faq/{faq_id}")
async def delete_faq(
    faq_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FAQEntry).where(FAQEntry.id == faq_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="FAQ entry not found")
    await db.delete(entry)
    await db.commit()
    return {"detail": "FAQ entry deleted"}


# --- Rescues (admin view) ---

@router.get("/rescues")
async def list_all_rescues(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.schemas.rescue import RescueOut

    result = await db.execute(select(Rescue).order_by(Rescue.created_at.desc()).limit(100))
    rescues = result.scalars().all()
    return [RescueOut.model_validate(r) for r in rescues]


# --- Helpers ---

async def _resolve_target_user(report: Report, db: AsyncSession) -> UUID | None:
    if report.target_type == "user":
        return report.target_id
    if report.target_type == "dog":
        result = await db.execute(select(Dog.owner_id).where(Dog.id == report.target_id))
        row = result.first()
        return row[0] if row else None
    if report.target_type == "photo":
        from app.models.photo import Photo

        result = await db.execute(select(Photo.dog_id).where(Photo.id == report.target_id))
        row = result.first()
        if row:
            dog_result = await db.execute(select(Dog.owner_id).where(Dog.id == row[0]))
            dog_row = dog_result.first()
            return dog_row[0] if dog_row else None
    return None
