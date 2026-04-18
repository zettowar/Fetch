from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select, func, or_, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import require_admin
from app.models.audit_log import AuditLog
from app.models.beta import Feedback, InviteCode
from app.models.breed import Breed, dog_breeds
from app.models.dog import Dog
from app.models.lost_report import LostReport
from app.models.park import Park
from app.models.photo import Photo
from app.models.report import Report, Strike
from app.models.rescue import RescueProfile
from app.models.support import FAQEntry, SupportTicket
from app.models.user import User
from app.schemas.admin import (
    AdminDogOut,
    AdminLostReportOut,
    AdminUserOut,
    AuditLogOut,
    DashboardStats,
    DashboardTimeseries,
    FAQCreate,
    FAQUpdate,
    TicketStatusUpdate,
)
from app.breed_data import slugify
from app.schemas.breed import BreedAdminOut, BreedCreate, BreedUpdate
from app.schemas.report import ReportOut, ReportReview, StrikeOut
from app.services.breed_display import breed_display
from app.schemas.park_import import (
    ParkImportHistoryEntry,
    ParkImportRequest,
    ParkImportResponse,
)
from app.schemas.rescue import RescueProfileOut, RescueReviewRequest
from app.schemas.support import FAQOut, TicketOut
from app.services.park_import import import_osm_dog_parks

DEFAULT_PAGE_LIMIT = 50
MAX_PAGE_LIMIT = 200

router = APIRouter()

STRIKE_THRESHOLD = 3


# --- Audit logging helper ---

async def _log(
    db: AsyncSession,
    *,
    actor_id: UUID,
    action: str,
    target_type: str | None = None,
    target_id: UUID | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(AuditLog(
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata_=metadata,
    ))


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
    unverified_rescues = (await db.execute(
        select(func.count()).where(RescueProfile.status == "pending")
    )).scalar() or 0
    unused_invites = (await db.execute(select(func.count()).where(InviteCode.is_used == False))).scalar() or 0
    total_feedback = (await db.execute(select(func.count()).select_from(Feedback))).scalar() or 0
    reports_7d = (await db.execute(select(func.count()).where(Report.created_at >= week_ago))).scalar() or 0

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


@router.get("/stats/timeseries", response_model=DashboardTimeseries)
async def dashboard_timeseries(
    days: int = Query(14, ge=1, le=90),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Daily counts of new users, reports, and dogs over the last `days` days."""
    now = datetime.now(timezone.utc)
    today = now.date()
    start = today - timedelta(days=days - 1)

    async def daily_counts(date_col) -> dict[datetime, int]:
        day_col = cast(date_col, Date).label("day")
        result = await db.execute(
            select(day_col, func.count())
            .where(date_col >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc))
            .group_by(day_col)
        )
        return {row[0]: row[1] for row in result.all()}

    users_map = await daily_counts(User.created_at)
    reports_map = await daily_counts(Report.created_at)
    dogs_map = await daily_counts(Dog.created_at)

    dates: list[str] = []
    new_users: list[int] = []
    new_reports: list[int] = []
    new_dogs: list[int] = []
    for i in range(days):
        d = start + timedelta(days=i)
        dates.append(d.isoformat())
        new_users.append(users_map.get(d, 0))
        new_reports.append(reports_map.get(d, 0))
        new_dogs.append(dogs_map.get(d, 0))

    return DashboardTimeseries(
        dates=dates,
        new_users=new_users,
        new_reports=new_reports,
        new_dogs=new_dogs,
    )


# --- Audit Log ---

@router.get("/audit", response_model=list[AuditLogOut])
async def list_audit_log(
    action: str | None = Query(None),
    target_type: str | None = Query(None),
    actor_id: UUID | None = Query(None),
    target_id: UUID | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if action:
        query = query.where(AuditLog.action == action)
    if target_type:
        query = query.where(AuditLog.target_type == target_type)
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
    if target_id:
        query = query.where(AuditLog.target_id == target_id)
    result = await db.execute(query)
    return list(result.scalars().all())


# --- User Management ---

@router.get("/users/search", response_model=list[AdminUserOut])
async def search_users(
    response: Response,
    q: str = Query(default=""),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Correlated subqueries avoid the N+1 per-user count lookups.
    dog_count_sq = (
        select(func.count())
        .where(Dog.owner_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    strike_count_sq = (
        select(func.count())
        .where(Strike.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )

    filter_clause = None
    if q:
        filter_clause = or_(
            User.email.ilike(f"%{q}%"),
            User.display_name.ilike(f"%{q}%"),
        )

    count_stmt = select(func.count()).select_from(User)
    if filter_clause is not None:
        count_stmt = count_stmt.where(filter_clause)
    total = (await db.execute(count_stmt)).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    stmt = (
        select(User, dog_count_sq.label("dog_count"), strike_count_sq.label("strike_count"))
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if filter_clause is not None:
        stmt = stmt.where(filter_clause)

    result = await db.execute(stmt)
    return [
        AdminUserOut(
            id=u.id, email=u.email, display_name=u.display_name,
            location_rough=u.location_rough, is_active=u.is_active,
            is_verified=u.is_verified, role=u.role, created_at=u.created_at,
            dog_count=dog_count, strike_count=strike_count,
        )
        for u, dog_count, strike_count in result.all()
    ]


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
    await _log(db, actor_id=admin.id, action="user.suspend", target_type="user", target_id=user_id,
               metadata={"email": user.email})
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
    await _log(db, actor_id=admin.id, action="user.reinstate", target_type="user", target_id=user_id,
               metadata={"email": user.email})
    await db.commit()
    return {"detail": "User reinstated"}


@router.post("/users/{user_id}/promote")
async def promote_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    user.role = "admin"
    await _log(db, actor_id=admin.id, action="user.promote", target_type="user", target_id=user_id,
               metadata={"email": user.email, "new_role": "admin"})
    await db.commit()
    return {"detail": "User promoted to admin"}


@router.post("/users/{user_id}/demote")
async def demote_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    user.role = "user"
    await _log(db, actor_id=admin.id, action="user.demote", target_type="user", target_id=user_id,
               metadata={"email": user.email, "new_role": "user"})
    await db.commit()
    return {"detail": "User demoted to regular user"}


# --- Reports ---

@router.get("/reports", response_model=list[ReportOut])
async def list_reports(
    response: Response,
    status_filter: str = Query("pending"),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    base = select(Report)
    if status_filter != "all":
        base = base.where(Report.status == status_filter)

    count_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = count_result.scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    result = await db.execute(
        base.order_by(Report.created_at.desc()).offset(offset).limit(limit)
    )
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

    strike_applied = False
    if body.apply_strike and body.status == "reviewed":
        target_user_id = await _resolve_target_user(report, db)
        if target_user_id:
            strike = Strike(
                user_id=target_user_id,
                report_id=report.id,
                reason=body.strike_reason or report.reason,
            )
            db.add(strike)
            strike_applied = True

            count_result = await db.execute(
                select(func.count()).where(Strike.user_id == target_user_id)
            )
            strike_count = (count_result.scalar() or 0) + 1
            if strike_count >= STRIKE_THRESHOLD:
                user_result = await db.execute(select(User).where(User.id == target_user_id))
                target_user = user_result.scalar_one_or_none()
                if target_user:
                    target_user.is_active = False

    await _log(db, actor_id=admin.id, action="report.review", target_type="report", target_id=report_id,
               metadata={"status": body.status, "strike_applied": strike_applied})
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/strikes/{user_id}", response_model=list[StrikeOut])
async def get_user_strikes(
    user_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Strike)
        .where(Strike.user_id == user_id)
        .order_by(Strike.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/users/{user_id}/reports-filed", response_model=list[ReportOut])
async def get_user_reports_filed(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reports filed BY this user."""
    result = await db.execute(
        select(Report)
        .where(Report.reporter_id == user_id)
        .order_by(Report.created_at.desc())
        .limit(200)
    )
    return list(result.scalars().all())


@router.get("/users/{user_id}/reports-against", response_model=list[ReportOut])
async def get_user_reports_against(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reports that ultimately target this user (direct, via dog ownership, or via photo->dog->owner)."""
    # Direct reports against the user.
    direct = select(Report).where(
        Report.target_type == "user", Report.target_id == user_id
    )
    # Reports against any dog owned by this user.
    owned_dog_ids = select(Dog.id).where(Dog.owner_id == user_id)
    via_dog = select(Report).where(
        Report.target_type == "dog", Report.target_id.in_(owned_dog_ids)
    )
    # Reports against any photo belonging to any dog owned by this user.
    owned_photo_ids = select(Photo.id).where(Photo.dog_id.in_(owned_dog_ids))
    via_photo = select(Report).where(
        Report.target_type == "photo", Report.target_id.in_(owned_photo_ids)
    )

    combined = direct.union(via_dog, via_photo).subquery()
    result = await db.execute(
        select(Report)
        .join(combined, Report.id == combined.c.id)
        .order_by(Report.created_at.desc())
        .limit(200)
    )
    return list(result.scalars().all())


@router.get("/users/{user_id}/rescue-profile", response_model=RescueProfileOut | None)
async def get_user_rescue_profile(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Single rescue profile this user owns, if any."""
    result = await db.execute(
        select(RescueProfile).where(RescueProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


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
    await _log(db, actor_id=admin.id, action="ticket.update", target_type="ticket", target_id=ticket_id,
               metadata={"status": body.status})
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
    await db.flush()
    await _log(db, actor_id=admin.id, action="faq.create", target_type="faq", target_id=entry.id,
               metadata={"question": body.question[:80]})
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
    await _log(db, actor_id=admin.id, action="faq.update", target_type="faq", target_id=faq_id,
               metadata=body.model_dump(exclude_unset=True))
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
    await _log(db, actor_id=admin.id, action="faq.delete", target_type="faq", target_id=faq_id,
               metadata={"question": entry.question[:80]})
    await db.delete(entry)
    await db.commit()
    return {"detail": "FAQ entry deleted"}


# --- Rescue profiles (admin view) ---

@router.get("/rescue-profiles", response_model=list[RescueProfileOut])
async def list_rescue_profiles(
    response: Response,
    status_filter: str = Query("pending"),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filter_base = select(RescueProfile.id)
    if status_filter != "all":
        filter_base = filter_base.where(RescueProfile.status == status_filter)
    total = (await db.execute(
        select(func.count()).select_from(filter_base.subquery())
    )).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    query = (
        select(RescueProfile)
        .order_by(RescueProfile.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if status_filter != "all":
        query = query.where(RescueProfile.status == status_filter)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.post("/rescue-profiles/{profile_id}/review", response_model=RescueProfileOut)
async def review_rescue_profile(
    profile_id: UUID,
    body: RescueReviewRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RescueProfile).where(RescueProfile.id == profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue profile not found")
    if profile.status != "pending":
        raise HTTPException(status_code=400, detail="Profile has already been reviewed")

    profile.status = "approved" if body.approve else "rejected"
    profile.review_note = body.note
    profile.reviewed_by = admin.id
    profile.reviewed_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        actor_id=admin.id,
        action="rescue.approve" if body.approve else "rescue.reject",
        target_type="rescue_profile",
        target_id=profile_id,
        metadata_={"org_name": profile.org_name, "note": body.note},
    ))
    await db.commit()
    await db.refresh(profile)
    return profile


# --- Content moderation: dogs ---

@router.get("/dogs", response_model=list[AdminDogOut])
async def list_dogs_admin(
    response: Response,
    q: str = Query(default=""),
    active_only: bool = Query(False),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    photo_count_sq = (
        select(func.count())
        .where(Photo.dog_id == Dog.id)
        .correlate(Dog)
        .scalar_subquery()
    )

    # Search matches dog name OR any joined breed name
    breed_match_sq = (
        select(dog_breeds.c.dog_id)
        .join(Breed, Breed.id == dog_breeds.c.breed_id)
        .where(Breed.name.ilike(f"%{q}%"))
    ) if q else None

    filter_base = select(Dog.id)
    if q:
        filter_base = filter_base.where(
            or_(Dog.name.ilike(f"%{q}%"), Dog.id.in_(breed_match_sq))
        )
    if active_only:
        filter_base = filter_base.where(Dog.is_active == True)  # noqa: E712

    count_result = await db.execute(select(func.count()).select_from(filter_base.subquery()))
    total = count_result.scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    query = (
        select(Dog, photo_count_sq.label("photo_count"))
        .options(selectinload(Dog.owner), selectinload(Dog.breeds))
        .order_by(Dog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if q:
        query = query.where(
            or_(Dog.name.ilike(f"%{q}%"), Dog.id.in_(breed_match_sq))
        )
    if active_only:
        query = query.where(Dog.is_active == True)  # noqa: E712

    result = await db.execute(query)
    return [
        AdminDogOut(
            id=d.id,
            name=d.name,
            breed=breed_display(d.mix_type, d.breeds),
            is_active=d.is_active,
            owner_id=d.owner_id,
            owner_name=d.owner.display_name if d.owner else None,
            owner_email=d.owner.email if d.owner else None,
            photo_count=count,
            created_at=d.created_at,
        )
        for d, count in result.all()
    ]


@router.post("/dogs/{dog_id}/deactivate")
async def deactivate_dog(
    dog_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Dog).where(Dog.id == dog_id))
    dog = result.scalar_one_or_none()
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found")
    dog.is_active = False
    await _log(db, actor_id=admin.id, action="dog.deactivate", target_type="dog", target_id=dog_id,
               metadata={"name": dog.name, "owner_id": str(dog.owner_id)})
    await db.commit()
    return {"detail": "Dog deactivated"}


@router.post("/dogs/{dog_id}/reactivate")
async def reactivate_dog(
    dog_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Dog).where(Dog.id == dog_id))
    dog = result.scalar_one_or_none()
    if not dog:
        raise HTTPException(status_code=404, detail="Dog not found")
    dog.is_active = True
    await _log(db, actor_id=admin.id, action="dog.reactivate", target_type="dog", target_id=dog_id,
               metadata={"name": dog.name, "owner_id": str(dog.owner_id)})
    await db.commit()
    return {"detail": "Dog reactivated"}


# --- Lost Reports (admin view) ---

@router.get("/lost-reports", response_model=list[AdminLostReportOut])
async def list_lost_reports_admin(
    response: Response,
    status_filter: str = Query("open"),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filter_base = select(LostReport.id)
    if status_filter != "all":
        filter_base = filter_base.where(LostReport.status == status_filter)
    count_result = await db.execute(select(func.count()).select_from(filter_base.subquery()))
    total = count_result.scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    query = (
        select(LostReport)
        .options(selectinload(LostReport.reporter), selectinload(LostReport.dog))
        .order_by(LostReport.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if status_filter != "all":
        query = query.where(LostReport.status == status_filter)
    result = await db.execute(query)
    reports = result.scalars().all()

    return [
        AdminLostReportOut(
            id=r.id,
            kind=r.kind,
            status=r.status,
            description=r.description,
            reporter_id=r.reporter_id,
            reporter_name=r.reporter.display_name if r.reporter else None,
            dog_id=r.dog_id,
            dog_name=r.dog.name if r.dog else None,
            created_at=r.created_at,
        )
        for r in reports
    ]


@router.post("/lost-reports/{report_id}/close")
async def close_lost_report(
    report_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LostReport).where(LostReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Lost report not found")
    report.status = "closed"
    report.resolved_at = datetime.now(timezone.utc)
    report.resolved_by = admin.id
    await _log(db, actor_id=admin.id, action="lost_report.close", target_type="lost_report", target_id=report_id)
    await db.commit()
    return {"detail": "Lost report closed"}


# --- Breeds management ---

@router.get("/breeds", response_model=list[BreedAdminOut])
async def list_breeds_admin(
    response: Response,
    q: str = Query(default=""),
    include_inactive: bool = Query(True),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filter_base = select(Breed.id)
    if not include_inactive:
        filter_base = filter_base.where(Breed.is_active == True)  # noqa: E712
    if q:
        filter_base = filter_base.where(Breed.name.ilike(f"%{q.strip()}%"))
    total = (await db.execute(select(func.count()).select_from(filter_base.subquery()))).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    dog_count_sq = (
        select(func.count())
        .select_from(dog_breeds)
        .where(dog_breeds.c.breed_id == Breed.id)
        .correlate(Breed)
        .scalar_subquery()
    )

    query = (
        select(Breed, dog_count_sq.label("dog_count"))
        .order_by(Breed.name.asc())
        .offset(offset)
        .limit(limit)
    )
    if not include_inactive:
        query = query.where(Breed.is_active == True)  # noqa: E712
    if q:
        query = query.where(Breed.name.ilike(f"%{q.strip()}%"))

    result = await db.execute(query)
    return [
        BreedAdminOut(
            id=b.id,
            name=b.name,
            slug=b.slug,
            group=b.group,
            is_active=b.is_active,
            dog_count=count,
            created_at=b.created_at,
        )
        for b, count in result.all()
    ]


@router.post("/breeds", response_model=BreedAdminOut, status_code=201)
async def create_breed(
    body: BreedCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    slug = slugify(body.name)
    existing = await db.execute(
        select(Breed).where((Breed.name == body.name) | (Breed.slug == slug))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Breed already exists")
    breed = Breed(name=body.name, slug=slug, group=body.group, is_active=body.is_active)
    db.add(breed)
    await db.flush()
    await _log(db, actor_id=admin.id, action="breed.create", target_type="breed",
               target_id=breed.id, metadata={"name": breed.name})
    await db.commit()
    await db.refresh(breed)
    return BreedAdminOut(
        id=breed.id, name=breed.name, slug=breed.slug, group=breed.group,
        is_active=breed.is_active, dog_count=0, created_at=breed.created_at,
    )


@router.patch("/breeds/{breed_id}", response_model=BreedAdminOut)
async def update_breed(
    breed_id: UUID,
    body: BreedUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Breed).where(Breed.id == breed_id))
    breed = result.scalar_one_or_none()
    if not breed:
        raise HTTPException(status_code=404, detail="Breed not found")

    changes = body.model_dump(exclude_unset=True)
    if "name" in changes and changes["name"] != breed.name:
        new_slug = slugify(changes["name"])
        conflict = await db.execute(
            select(Breed).where(
                ((Breed.name == changes["name"]) | (Breed.slug == new_slug))
                & (Breed.id != breed_id)
            )
        )
        if conflict.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Another breed with that name exists")
        breed.slug = new_slug
    for field, value in changes.items():
        setattr(breed, field, value)

    await _log(db, actor_id=admin.id, action="breed.update", target_type="breed",
               target_id=breed_id, metadata=changes)
    await db.commit()
    await db.refresh(breed)

    dog_count = (await db.execute(
        select(func.count()).select_from(dog_breeds).where(dog_breeds.c.breed_id == breed_id)
    )).scalar() or 0
    return BreedAdminOut(
        id=breed.id, name=breed.name, slug=breed.slug, group=breed.group,
        is_active=breed.is_active, dog_count=dog_count, created_at=breed.created_at,
    )


@router.delete("/breeds/{breed_id}")
async def delete_breed(
    breed_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Breed).where(Breed.id == breed_id))
    breed = result.scalar_one_or_none()
    if not breed:
        raise HTTPException(status_code=404, detail="Breed not found")

    dog_count = (await db.execute(
        select(func.count()).select_from(dog_breeds).where(dog_breeds.c.breed_id == breed_id)
    )).scalar() or 0
    if dog_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {dog_count} dog(s) still reference this breed. Deactivate instead.",
        )

    await _log(db, actor_id=admin.id, action="breed.delete", target_type="breed",
               target_id=breed_id, metadata={"name": breed.name})
    await db.delete(breed)
    await db.commit()
    return {"detail": "Breed deleted"}


# --- Parks: external-dataset import ---

@router.post("/parks/import-osm", response_model=ParkImportResponse)
async def import_parks_from_osm(
    body: ParkImportRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Pull dog parks from OpenStreetMap (via Overpass API) and upsert them.

    - Touches only `source='osm'` rows; user-submitted parks are untouched.
    - Optional `bbox` (south, west, north, east) scopes the import to a region.
      Omit for a worldwide import (can take 60+ seconds).
    """
    result = await import_osm_dog_parks(db, bbox=body.bbox)
    db.add(AuditLog(
        actor_id=admin.id,
        action="parks.import_osm",
        target_type="parks",
        metadata_={
            "bbox": list(body.bbox) if body.bbox else None,
            **result.to_dict(),
        },
    ))
    await db.commit()
    return ParkImportResponse(**result.to_dict())


@router.get("/parks/import-history", response_model=list[ParkImportHistoryEntry])
async def list_park_import_history(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Last 20 OSM imports from the audit log, with per-run stats."""
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.action == "parks.import_osm")
        .order_by(AuditLog.created_at.desc())
        .limit(20)
    )
    rows = list(result.scalars().all())

    actor_ids = [r.actor_id for r in rows if r.actor_id]
    actors: dict[UUID, str] = {}
    if actor_ids:
        actor_res = await db.execute(
            select(User.id, User.display_name).where(User.id.in_(actor_ids))
        )
        for uid, name in actor_res.all():
            actors[uid] = name

    out: list[ParkImportHistoryEntry] = []
    for r in rows:
        meta = r.metadata_ or {}
        bbox_raw = meta.get("bbox")
        out.append(ParkImportHistoryEntry(
            id=r.id,
            actor_id=r.actor_id,
            actor_name=actors.get(r.actor_id) if r.actor_id else None,
            created=int(meta.get("created", 0)),
            updated=int(meta.get("updated", 0)),
            total_fetched=int(meta.get("total_fetched", 0)),
            bbox=tuple(bbox_raw) if bbox_raw and len(bbox_raw) == 4 else None,
            created_at=r.created_at,
        ))
    return out


@router.get("/parks/stats")
async def park_source_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Breakdown of parks by data source — handy for the admin dashboard."""
    result = await db.execute(
        select(Park.source, func.count()).group_by(Park.source)
    )
    by_source = {source or "unknown": count for source, count in result.all()}
    total = sum(by_source.values())
    return {"total": total, "by_source": by_source}


# --- Helpers ---

async def _resolve_target_user(report: Report, db: AsyncSession) -> UUID | None:
    if report.target_type == "user":
        return report.target_id
    if report.target_type == "dog":
        result = await db.execute(select(Dog.owner_id).where(Dog.id == report.target_id))
        row = result.first()
        return row[0] if row else None
    if report.target_type == "photo":
        result = await db.execute(select(Photo.dog_id).where(Photo.id == report.target_id))
        row = result.first()
        if row:
            dog_result = await db.execute(select(Dog.owner_id).where(Dog.id == row[0]))
            dog_row = dog_result.first()
            return dog_row[0] if dog_row else None
    return None
