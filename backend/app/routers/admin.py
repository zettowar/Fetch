from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select, func, or_, case, cast, delete, update, Date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import STAFF_ROLES, require_admin, require_staff
from app.models.adoption import AdoptionInquiry
from app.models.audit_log import AuditLog
from app.models.beta import Feedback, InviteCode
from app.models.breed import Breed, pet_breeds
from app.models.pet import Pet
from app.models.donation import Donation
from app.models.entitlement import Entitlement
from app.models.lost_report import LostReport, LostReportPhoto, LostReportSighting
from app.models.news import NewsPost
from app.models.park import Park
from app.models.photo import Photo
from app.models.report import Report, Strike
from app.models.rescue import RescueProfile
from app.models.social import Comment
from app.models.support import FAQEntry, SupportTicket
from app.models.user import User
from app.models.qr_tag import QRTag
from app.services.qr_service import generate_unique_codes
from app.schemas.admin import (
    AdminPetOut,
    AdminLostReportOut,
    AdminTagOut,
    AdminUserOut,
    AuditLogOut,
    DashboardStats,
    DashboardTimeseries,
    FAQCreate,
    FAQUpdate,
    FlaggedPhotoOut,
    TagAssignRequest,
    TagGenerateRequest,
    TicketStatusUpdate,
)
from app.storage import get_storage
from app.breed_data import slugify
from app.models.pet_trait import PetTrait
from app.schemas.breed import BreedAdminOut, BreedCreate, BreedUpdate
from app.schemas.pet_trait import PetTraitAdminOut, PetTraitCreate, PetTraitUpdate
from app.services.traits import (
    remove_trait_from_pets,
    rename_trait_on_pets,
    trait_slug,
    trait_usage_counts,
)
from app.schemas.report import ReportOut, ReportReview, StrikeOut
from app.services.breed_display import breed_display
from app.schemas.park_import import (
    ParkImportHistoryEntry,
    ParkImportRequest,
    ParkImportResponse,
)
from app.schemas.news import NewsPostCreate, NewsPostOut, NewsPostUpdate
from app.schemas.rescue import RescueProfileOut, RescueReviewRequest
from app.schemas.support import FAQOut, TicketOut
from app.services.notify import notify
from app.services.park_import import import_osm_dog_parks
from app.services.vet_import import import_osm_vets
from app.models.vet import Vet
from app.schemas.park import ParkOut
from app.schemas.vet import VetOut

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
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    active_users = (await db.execute(select(func.count()).where(User.is_active == True))).scalar() or 0
    suspended_users = (await db.execute(select(func.count()).where(User.is_active == False))).scalar() or 0
    users_7d = (await db.execute(select(func.count()).where(User.created_at >= week_ago))).scalar() or 0
    total_pets = (await db.execute(select(func.count()).select_from(Pet))).scalar() or 0
    pending_reports = (await db.execute(select(func.count()).where(Report.status == "pending"))).scalar() or 0
    open_tickets = (await db.execute(select(func.count()).where(SupportTicket.status == "open"))).scalar() or 0
    unverified_rescues = (await db.execute(
        select(func.count()).where(RescueProfile.status == "pending")
    )).scalar() or 0
    unused_invites = (await db.execute(select(func.count()).where(InviteCode.is_used == False))).scalar() or 0
    total_feedback = (await db.execute(select(func.count()).select_from(Feedback))).scalar() or 0
    reports_7d = (await db.execute(select(func.count()).where(Report.created_at >= week_ago))).scalar() or 0

    donations_total = (await db.execute(
        select(func.coalesce(func.sum(Donation.amount_cents), 0)).where(Donation.status == "succeeded")
    )).scalar() or 0
    donations_7d = (await db.execute(
        select(func.coalesce(func.sum(Donation.amount_cents), 0)).where(
            Donation.status == "succeeded", Donation.created_at >= week_ago
        )
    )).scalar() or 0
    open_inquiries = (await db.execute(
        select(func.count()).where(AdoptionInquiry.status == "new")
    )).scalar() or 0

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
        total_pets=total_pets,
        pending_reports=pending_reports,
        open_tickets=open_tickets,
        unverified_rescues=unverified_rescues,
        unused_invites=unused_invites,
        total_feedback=total_feedback,
        reports_last_7d=reports_7d,
        oldest_pending_report_hours=oldest_report_hours,
        oldest_open_ticket_hours=oldest_ticket_hours,
        donations_total_cents=int(donations_total),
        donations_last_7d_cents=int(donations_7d),
        open_inquiries=open_inquiries,
    )


@router.get("/stats/timeseries", response_model=DashboardTimeseries)
async def dashboard_timeseries(
    days: int = Query(14, ge=1, le=90),
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Daily counts of new users, reports, and pets over the last `days` days."""
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
    dogs_map = await daily_counts(Pet.created_at)

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
    admin: User = Depends(require_staff),
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


# --- Donations ---

@router.get("/donations")
async def list_donations(
    status_filter: str | None = Query(None, alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Donation oversight: paginated rows + succeeded totals."""
    from app.schemas.donation import DonationOut

    query = select(Donation).order_by(Donation.created_at.desc())
    count_stmt = select(func.count()).select_from(Donation)
    if status_filter:
        query = query.where(Donation.status == status_filter)
        count_stmt = count_stmt.where(Donation.status == status_filter)
    rows = (await db.execute(query.offset(offset).limit(limit))).scalars().all()
    total = (await db.execute(count_stmt)).scalar() or 0

    totals = (await db.execute(
        select(
            func.count(Donation.id),
            func.coalesce(func.sum(Donation.amount_cents), 0),
            func.coalesce(func.sum(Donation.application_fee_cents), 0),
        ).where(Donation.status == "succeeded")
    )).one()
    return {
        "items": [DonationOut.model_validate(r).model_dump(mode="json") for r in rows],
        "total": total,
        "succeeded_count": totals[0],
        "succeeded_amount_cents": int(totals[1]),
        "succeeded_fee_cents": int(totals[2]),
    }


# --- User Management ---

@router.get("/users/search", response_model=list[AdminUserOut])
async def search_users(
    response: Response,
    q: str = Query(default=""),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    # Correlated subqueries avoid the N+1 per-user count lookups.
    pet_count_sq = (
        select(func.count())
        .where(Pet.owner_id == User.id)
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
        select(User, pet_count_sq.label("pet_count"), strike_count_sq.label("strike_count"))
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
            pet_count=pet_count, strike_count=strike_count,
        )
        for u, pet_count, strike_count in result.all()
    ]


@router.get("/users/{user_id}", response_model=AdminUserOut)
async def get_user_detail(
    user_id: UUID,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    pet_count = (await db.execute(select(func.count()).where(Pet.owner_id == u.id))).scalar() or 0
    strike_count = (await db.execute(select(func.count()).where(Strike.user_id == u.id))).scalar() or 0

    return AdminUserOut(
        id=u.id, email=u.email, display_name=u.display_name,
        location_rough=u.location_rough, is_active=u.is_active,
        is_verified=u.is_verified, role=u.role, created_at=u.created_at,
        pet_count=pet_count, strike_count=strike_count,
    )


async def _suspend_with_dogs(user: User, db: AsyncSession) -> list[str]:
    """Suspend a user and hide their pets from feed/explore/rankings.

    Returns the ids of pets this suspension deactivated (as strings, for the
    audit-log metadata) so reinstatement can revive exactly those — pets that
    were already inactive for other reasons stay that way.
    """
    user.is_active = False
    result = await db.execute(
        update(Pet)
        .where(Pet.owner_id == user.id, Pet.is_active == True)  # noqa: E712
        .values(is_active=False)
        .returning(Pet.id)
    )
    return [str(pet_id) for pet_id in result.scalars().all()]


def _guard_staff_target(target: User, actor: User, verb: str) -> None:
    """Refuse staff-on-staff and self-targeted account-state actions.

    Mirrors the guards on ``delete_user``: without this a moderator can lock an
    admin out of the panel, and an admin can lock themselves out.
    """
    if target.id == actor.id:
        raise HTTPException(
            status_code=400, detail=f"You cannot {verb} your own account"
        )
    if target.role in STAFF_ROLES:
        raise HTTPException(
            status_code=400,
            detail=f"Demote this {target.role} before you {verb} their account",
        )


@router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: UUID,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Suspend an account and deactivate its pets.

    Guarded like ``delete_user``: suspension locks a colleague out of the admin
    panel, so a moderator must not be able to apply it to staff, and nobody
    should be able to lock themselves out.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    _guard_staff_target(user, admin, "suspend")
    deactivated = await _suspend_with_dogs(user, db)
    await _log(db, actor_id=admin.id, action="user.suspend", target_type="user", target_id=user_id,
               metadata={"email": user.email, "deactivated_dogs": deactivated})
    await db.commit()
    return {"detail": "User suspended"}


@router.post("/users/{user_id}/reinstate")
async def reinstate_user(
    user_id: UUID,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True

    # Revive only the pets the suspension itself deactivated.
    last_suspend = await db.execute(
        select(AuditLog)
        .where(AuditLog.action == "user.suspend", AuditLog.target_id == user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(1)
    )
    entry = last_suspend.scalar_one_or_none()
    pet_ids = (entry.metadata_ or {}).get("deactivated_dogs", []) if entry else []
    if pet_ids:
        await db.execute(
            update(Pet)
            .where(Pet.id.in_([UUID(d) for d in pet_ids]))
            .values(is_active=True)
        )

    await _log(db, actor_id=admin.id, action="user.reinstate", target_type="user", target_id=user_id,
               metadata={"email": user.email, "reactivated_dogs": pet_ids})
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


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a user account and everything they own.

    Unlike suspend (which flips ``is_active`` and is fully reversible), this
    destroys the row. The database's ``ON DELETE`` rules do the cascading:
    owned content (pets, photos, votes, follows, comments, posts, tickets,
    strikes, entitlements, …) is CASCADE-deleted, while records meant to
    outlive the account are preserved via SET NULL — donations keep their
    ``recipient_name`` snapshot, and the audit log's actor/target ids are
    plain UUID columns (no FK) so this action's own history survives.

    Irreversible, so it is guarded: an admin cannot delete their own account,
    and cannot delete another admin (demote them first — this prevents a
    single compromised or careless admin from erasing a colleague).
    """
    row = (await db.execute(
        select(User.id, User.email, User.display_name, User.role)
        .where(User.id == user_id)
    )).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    _uid, email, display_name, role = row

    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if role == "admin":
        raise HTTPException(
            status_code=400,
            detail="Demote this admin before deleting their account",
        )

    # Collect on-disk file keys BEFORE the rows vanish — the DB cascade removes
    # the photo rows but not the underlying files, exactly like reject_photo.
    owned_pet_ids = select(Pet.id).where(Pet.owner_id == user_id).scalar_subquery()
    pet_photo_keys = (await db.execute(
        select(Photo.storage_key).where(Photo.pet_id.in_(owned_pet_ids))
    )).scalars().all()
    lost_photo_keys = (await db.execute(
        select(LostReportPhoto.storage_key)
        .join(LostReport, LostReport.id == LostReportPhoto.report_id)
        .where(LostReport.reporter_id == user_id)
    )).scalars().all()
    sighting_keys = (await db.execute(
        select(LostReportSighting.photo_key).where(
            LostReportSighting.reporter_id == user_id,
            LostReportSighting.photo_key.is_not(None),
        )
    )).scalars().all()
    storage_keys = [*pet_photo_keys, *lost_photo_keys, *sighting_keys]

    pet_count = (await db.execute(
        select(func.count()).where(Pet.owner_id == user_id)
    )).scalar() or 0

    # Core DELETE: let Postgres cascade the whole graph in one statement rather
    # than loading every owned row into the session.
    await db.execute(delete(User).where(User.id == user_id))
    await _log(db, actor_id=admin.id, action="user.delete", target_type="user", target_id=user_id,
               metadata={"email": email, "display_name": display_name, "role": role,
                         "pets_deleted": pet_count, "photos_purged": len(storage_keys)})
    await db.commit()

    # Best-effort file cleanup; the rows are already gone, so a failure here
    # only leaves an unreachable orphan, never a dangling reference.
    storage = get_storage()
    for key in storage_keys:
        try:
            await storage.delete(key)
        except Exception:
            pass

    return {
        "detail": "User permanently deleted",
        "pets_deleted": pet_count,
        "photos_purged": len(storage_keys),
    }


# --- Reports ---

@router.get("/reports", response_model=list[ReportOut])
async def list_reports(
    response: Response,
    status_filter: str = Query("pending"),
    q: str = Query(default=""),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    base = select(Report)
    if status_filter != "all":
        base = base.where(Report.status == status_filter)
    if q:
        base = base.where(or_(Report.reason.ilike(f"%{q}%"), Report.admin_notes.ilike(f"%{q}%")))

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
    admin: User = Depends(require_staff),
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
        if not target_user_id:
            # Previously this fell through and returned 200, so a moderator who
            # struck a reported comment saw success while nothing happened.
            raise HTTPException(
                status_code=422,
                detail="Cannot apply a strike: this report has no resolvable author",
            )
        if target_user_id:
            strike = Strike(
                user_id=target_user_id,
                report_id=report.id,
                reason=body.strike_reason or report.reason,
            )
            db.add(strike)
            strike_applied = True

            # Autoflush means the count already includes the strike added above.
            count_result = await db.execute(
                select(func.count()).where(Strike.user_id == target_user_id)
            )
            strike_count = count_result.scalar() or 0
            if strike_count >= STRIKE_THRESHOLD:
                user_result = await db.execute(select(User).where(User.id == target_user_id))
                target_user = user_result.scalar_one_or_none()
                # Staff are never auto-suspended by the strike threshold, for
                # the same reason _guard_staff_target blocks it manually.
                if target_user and target_user.role not in STAFF_ROLES:
                    deactivated = await _suspend_with_dogs(target_user, db)
                    # Logged as user.suspend so reinstatement can find the
                    # pet list, same as a manual suspension.
                    await _log(db, actor_id=admin.id, action="user.suspend",
                               target_type="user", target_id=target_user.id,
                               metadata={"email": target_user.email,
                                         "reason": "strike_threshold",
                                         "deactivated_dogs": deactivated})

    await _log(db, actor_id=admin.id, action="report.review", target_type="report", target_id=report_id,
               metadata={"status": body.status, "strike_applied": strike_applied})
    await db.commit()
    await db.refresh(report)
    return report


@router.get("/strikes/{user_id}", response_model=list[StrikeOut])
async def get_user_strikes(
    user_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Strike)
        .where(Strike.user_id == user_id)
        .order_by(Strike.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/users/{user_id}/entitlements")
async def get_user_entitlements(
    user_id: UUID,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """All entitlements granted to a user (admin view)."""
    result = await db.execute(
        select(Entitlement)
        .where(Entitlement.user_id == user_id)
        .order_by(Entitlement.created_at.desc())
    )
    return [
        {
            "id": str(e.id),
            "entitlement_key": e.entitlement_key,
            "source": e.source,
            "expires_at": e.expires_at.isoformat() if e.expires_at else None,
            "created_at": e.created_at.isoformat(),
        }
        for e in result.scalars().all()
    ]


@router.get("/users/{user_id}/reports-filed", response_model=list[ReportOut])
async def get_user_reports_filed(
    user_id: UUID,
    admin: User = Depends(require_staff),
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
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Reports that ultimately target this user (direct, via pet ownership, or via photo->pet->owner)."""
    # Direct reports against the user.
    direct = select(Report).where(
        Report.target_type == "user", Report.target_id == user_id
    )
    # Reports against any pet owned by this user.
    owned_pet_ids = select(Pet.id).where(Pet.owner_id == user_id)
    via_dog = select(Report).where(
        Report.target_type == "pet", Report.target_id.in_(owned_pet_ids)
    )
    # Reports against any photo belonging to any pet owned by this user.
    owned_photo_ids = select(Photo.id).where(Photo.pet_id.in_(owned_pet_ids))
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
    admin: User = Depends(require_staff),
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
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.status = body.status
    ticket.assigned_to = admin.id
    # Persist the internal note (previously accepted by the schema but silently
    # dropped). Only overwrite when the caller actually supplied one.
    if body.admin_notes is not None:
        ticket.admin_notes = body.admin_notes
    await _log(db, actor_id=admin.id, action="ticket.update", target_type="ticket", target_id=ticket_id,
               metadata={"status": body.status, "noted": body.admin_notes is not None})
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


# --- News management (marketing-site articles) ---

@router.get("/news", response_model=list[NewsPostOut])
async def list_news_posts(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """All news posts, drafts included, newest activity first."""
    result = await db.execute(
        select(NewsPost).order_by(
            func.coalesce(NewsPost.published_at, NewsPost.created_at).desc()
        )
    )
    return list(result.scalars().all())


@router.post("/news", response_model=NewsPostOut, status_code=201)
async def create_news_post(
    body: NewsPostCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    post = NewsPost(
        title=body.title,
        body=body.body,
        tag=body.tag,
        link_url=body.link_url,
        link_label=body.link_label,
        is_published=body.is_published,
        published_at=func.now() if body.is_published else None,
        created_by=admin.id,
    )
    db.add(post)
    await db.flush()
    await _log(db, actor_id=admin.id, action="news.create", target_type="news", target_id=post.id,
               metadata={"title": body.title[:80]})
    await db.commit()
    await db.refresh(post)
    return post


@router.patch("/news/{post_id}", response_model=NewsPostOut)
async def update_news_post(
    post_id: UUID,
    body: NewsPostUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(NewsPost).where(NewsPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="News post not found")
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(post, field, value)
    # First publish stamps the display date (kept on later unpublish/republish
    # so the article's place in history is stable; editable via published_at).
    if post.is_published and post.published_at is None:
        post.published_at = func.now()
    await _log(db, actor_id=admin.id, action="news.update", target_type="news", target_id=post_id,
               metadata={k: str(v)[:80] for k, v in changes.items()})
    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/news/{post_id}")
async def delete_news_post(
    post_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(NewsPost).where(NewsPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="News post not found")
    await _log(db, actor_id=admin.id, action="news.delete", target_type="news", target_id=post_id,
               metadata={"title": post.title[:80]})
    await db.delete(post)
    await db.commit()
    return {"detail": "News post deleted"}


# --- Rescue profiles (admin view) ---

@router.get("/rescue-profiles", response_model=list[RescueProfileOut])
async def list_rescue_profiles(
    response: Response,
    status_filter: str = Query("pending"),
    q: str = Query(default=""),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if status_filter != "all":
        filters.append(RescueProfile.status == status_filter)
    if q:
        filters.append(or_(
            RescueProfile.org_name.ilike(f"%{q}%"),
            RescueProfile.location.ilike(f"%{q}%"),
        ))

    count_stmt = select(func.count()).select_from(RescueProfile)
    for f in filters:
        count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    query = select(RescueProfile).order_by(RescueProfile.created_at.desc())
    for f in filters:
        query = query.where(f)
    result = await db.execute(query.offset(offset).limit(limit))
    return list(result.scalars().all())


@router.post("/rescue-profiles/{profile_id}/review", response_model=RescueProfileOut)
async def review_rescue_profile(
    profile_id: UUID,
    body: RescueReviewRequest,
    admin: User = Depends(require_staff),
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


# --- Content moderation: pets ---

@router.get("/pets", response_model=list[AdminPetOut])
async def list_dogs_admin(
    response: Response,
    q: str = Query(default=""),
    active_only: bool = Query(False),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    photo_count_sq = (
        select(func.count())
        .where(Photo.pet_id == Pet.id)
        .correlate(Pet)
        .scalar_subquery()
    )

    # Search matches pet name OR any joined breed name
    breed_match_sq = (
        select(pet_breeds.c.pet_id)
        .join(Breed, Breed.id == pet_breeds.c.breed_id)
        .where(Breed.name.ilike(f"%{q}%"))
    ) if q else None

    filter_base = select(Pet.id)
    if q:
        filter_base = filter_base.where(
            or_(Pet.name.ilike(f"%{q}%"), Pet.id.in_(breed_match_sq))
        )
    if active_only:
        filter_base = filter_base.where(Pet.is_active == True)  # noqa: E712

    count_result = await db.execute(select(func.count()).select_from(filter_base.subquery()))
    total = count_result.scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    query = (
        select(Pet, photo_count_sq.label("photo_count"))
        .options(selectinload(Pet.owner), selectinload(Pet.breeds))
        .order_by(Pet.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if q:
        query = query.where(
            or_(Pet.name.ilike(f"%{q}%"), Pet.id.in_(breed_match_sq))
        )
    if active_only:
        query = query.where(Pet.is_active == True)  # noqa: E712

    result = await db.execute(query)
    return [
        AdminPetOut(
            id=d.id,
            name=d.name,
            breed=breed_display(d.mix_type, d.breeds, d.species),
            is_active=d.is_active,
            owner_id=d.owner_id,
            owner_name=d.owner.display_name if d.owner else None,
            owner_email=d.owner.email if d.owner else None,
            photo_count=count,
            created_at=d.created_at,
        )
        for d, count in result.all()
    ]


@router.post("/pets/{pet_id}/deactivate")
async def deactivate_dog(
    pet_id: UUID,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    pet.is_active = False
    await _log(db, actor_id=admin.id, action="pet.deactivate", target_type="pet", target_id=pet_id,
               metadata={"name": pet.name, "owner_id": str(pet.owner_id)})
    await db.commit()
    return {"detail": "Pet deactivated"}


@router.post("/pets/{pet_id}/reactivate")
async def reactivate_dog(
    pet_id: UUID,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    pet.is_active = True
    await _log(db, actor_id=admin.id, action="pet.reactivate", target_type="pet", target_id=pet_id,
               metadata={"name": pet.name, "owner_id": str(pet.owner_id)})
    await db.commit()
    return {"detail": "Pet reactivated"}


# --- Flagged photo review queue ---
#
# Photos that Sightengine flags (or that hit its fail-closed fallback) are
# hidden from every read path, including the public file endpoint. This queue
# is the human backstop: approve to publish, reject to delete.

@router.get("/photos/flagged", response_model=list[FlaggedPhotoOut])
async def list_flagged_photos(
    response: Response,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    total = (
        await db.execute(
            select(func.count()).select_from(Photo).where(Photo.moderation_status == "flagged")
        )
    ).scalar() or 0
    result = await db.execute(
        select(Photo)
        .where(Photo.moderation_status == "flagged")
        .order_by(Photo.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    photos = list(result.scalars().all())

    pets: dict[UUID, Pet] = {}
    owners: dict[UUID, User] = {}
    if photos:
        pet_result = await db.execute(
            select(Pet).where(Pet.id.in_({p.pet_id for p in photos}))
        )
        pets = {d.id: d for d in pet_result.scalars().all()}
    if pets:
        owner_result = await db.execute(
            select(User).where(User.id.in_({d.owner_id for d in pets.values()}))
        )
        owners = {u.id: u for u in owner_result.scalars().all()}

    response.headers["X-Total-Count"] = str(total)
    out = []
    for p in photos:
        pet = pets.get(p.pet_id)
        owner = owners.get(pet.owner_id) if pet else None
        out.append(FlaggedPhotoOut(
            id=p.id,
            pet_id=p.pet_id,
            pet_name=pet.name if pet else None,
            owner_id=pet.owner_id if pet else None,
            owner_email=owner.email if owner else None,
            content_type=p.content_type,
            moderation_status=p.moderation_status,
            created_at=p.created_at,
        ))
    return out


@router.get("/photos/{photo_id}/file")
async def get_photo_file_admin(
    photo_id: UUID,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Serve a photo regardless of moderation status so reviewers can see it
    (the public file endpoint withholds anything not approved)."""
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    storage = get_storage()
    try:
        data = await storage.get(photo.storage_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=data, media_type=photo.content_type)


@router.post("/photos/{photo_id}/approve")
async def approve_photo(
    photo_id: UUID,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    photo.moderation_status = "approved"
    pet_result = await db.execute(select(Pet).where(Pet.id == photo.pet_id))
    pet = pet_result.scalar_one_or_none()
    if pet:
        # Upload skips the primary slot for photos held in review, so the first
        # one to clear moderation claims it — otherwise a pet whose only photo
        # was flagged stays without a primary after approval.
        if pet.primary_photo_id is None:
            pet.primary_photo_id = photo.id
        await notify(
            db, pet.owner_id,
            type="photo_moderated",
            title=f"A photo of {pet.name} was approved",
            body="It's now visible across Fetchpawz.",
            link=f"/app/pets/{pet.id}",
        )
    await _log(db, actor_id=admin.id, action="photo.approve", target_type="photo",
               target_id=photo_id, metadata={"pet_id": str(photo.pet_id)})
    await db.commit()
    return {"detail": "Photo approved"}


@router.post("/photos/{photo_id}/reject")
async def reject_photo(
    photo_id: UUID,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    pet_result = await db.execute(select(Pet).where(Pet.id == photo.pet_id))
    pet = pet_result.scalar_one_or_none()
    if pet and pet.primary_photo_id == photo.id:
        pet.primary_photo_id = None
    if pet:
        await notify(
            db, pet.owner_id,
            type="photo_moderated",
            title=f"A photo of {pet.name} was removed",
            body="It didn't pass review. You can upload a different one any time.",
            link=f"/app/pets/{pet.id}",
        )

    key = photo.storage_key
    await db.delete(photo)
    await _log(db, actor_id=admin.id, action="photo.reject", target_type="photo",
               target_id=photo_id, metadata={"pet_id": str(photo.pet_id)})
    await db.commit()

    storage = get_storage()
    try:
        await storage.delete(key)
    except Exception:
        pass  # row is gone; an orphaned file is harmless and unreachable
    return {"detail": "Photo rejected and deleted"}


# --- Lost Reports (admin view) ---

@router.get("/lost-reports", response_model=list[AdminLostReportOut])
async def list_lost_reports_admin(
    response: Response,
    status_filter: str = Query("open"),
    q: str = Query(default=""),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if status_filter != "all":
        filters.append(LostReport.status == status_filter)
    if q:
        filters.append(LostReport.description.ilike(f"%{q}%"))
    count_stmt = select(func.count()).select_from(LostReport)
    for f in filters:
        count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    query = (
        select(LostReport)
        .options(selectinload(LostReport.reporter), selectinload(LostReport.pet))
        .order_by(LostReport.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    for f in filters:
        query = query.where(f)
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
            pet_id=r.pet_id,
            pet_name=r.pet.name if r.pet else None,
            created_at=r.created_at,
        )
        for r in reports
    ]


@router.post("/lost-reports/{report_id}/close")
async def close_lost_report(
    report_id: UUID,
    admin: User = Depends(require_staff),
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

    pet_count_sq = (
        select(func.count())
        .select_from(pet_breeds)
        .where(pet_breeds.c.breed_id == Breed.id)
        .correlate(Breed)
        .scalar_subquery()
    )

    query = (
        select(Breed, pet_count_sq.label("pet_count"))
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
            pet_count=count,
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
    breed = Breed(name=body.name, slug=slug, group=body.group, species=body.species, is_active=body.is_active)
    db.add(breed)
    await db.flush()
    await _log(db, actor_id=admin.id, action="breed.create", target_type="breed",
               target_id=breed.id, metadata={"name": breed.name})
    await db.commit()
    await db.refresh(breed)
    return BreedAdminOut(
        id=breed.id, name=breed.name, slug=breed.slug, group=breed.group,
        is_active=breed.is_active, pet_count=0, created_at=breed.created_at,
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

    pet_count = (await db.execute(
        select(func.count()).select_from(pet_breeds).where(pet_breeds.c.breed_id == breed_id)
    )).scalar() or 0
    return BreedAdminOut(
        id=breed.id, name=breed.name, slug=breed.slug, group=breed.group,
        is_active=breed.is_active, pet_count=pet_count, created_at=breed.created_at,
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

    pet_count = (await db.execute(
        select(func.count()).select_from(pet_breeds).where(pet_breeds.c.breed_id == breed_id)
    )).scalar() or 0
    if pet_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete: {pet_count} pet(s) still reference this breed. Deactivate instead.",
        )

    await _log(db, actor_id=admin.id, action="breed.delete", target_type="breed",
               target_id=breed_id, metadata={"name": breed.name})
    await db.delete(breed)
    await db.commit()
    return {"detail": "Breed deleted"}


# --- Personality traits ---
#
# Pets store trait *labels* in `pets.traits`, not FKs, so editing the vocabulary
# means rewriting those arrays too: a rename propagates, a rejection or delete
# purges. See services/traits.py.

def _trait_out(trait: PetTrait, pet_count: int, author: str | None) -> PetTraitAdminOut:
    return PetTraitAdminOut(
        id=trait.id,
        label=trait.label,
        slug=trait.slug,
        species=trait.species,
        status=trait.status,
        sort_order=trait.sort_order,
        pet_count=pet_count,
        created_by_name=author,
        created_at=trait.created_at,
    )


@router.get("/pet-traits", response_model=list[PetTraitAdminOut])
async def list_pet_traits(
    response: Response,
    q: str = Query(default=""),
    status_filter: str | None = Query(None, alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """The trait vocabulary, pending submissions first (that's the work queue)."""
    filters = []
    if status_filter in ("approved", "pending", "rejected"):
        filters.append(PetTrait.status == status_filter)
    if q:
        filters.append(PetTrait.label.ilike(f"%{q.strip()}%"))

    total = (await db.execute(
        select(func.count()).select_from(PetTrait).where(*filters)
    )).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    result = await db.execute(
        select(PetTrait, User.display_name)
        .join(User, User.id == PetTrait.created_by, isouter=True)
        .where(*filters)
        .order_by(
            # pending → approved → rejected, so the queue is always on top.
            case({"pending": 0, "approved": 1}, value=PetTrait.status, else_=2),
            PetTrait.sort_order.asc(),
            PetTrait.label.asc(),
        )
        .offset(offset)
        .limit(limit)
    )
    rows = result.all()
    counts = await trait_usage_counts(db)
    return [_trait_out(t, counts.get(t.label, 0), author) for t, author in rows]


@router.post("/pet-traits", response_model=PetTraitAdminOut, status_code=201)
async def create_pet_trait(
    body: PetTraitCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    slug = trait_slug(body.label)
    existing = await db.execute(select(PetTrait).where(PetTrait.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="That trait already exists")
    trait = PetTrait(
        label=body.label,
        slug=slug,
        species=body.species,
        status=body.status,
        sort_order=body.sort_order,
        created_by=admin.id,
    )
    db.add(trait)
    await db.flush()
    await _log(db, actor_id=admin.id, action="pet_trait.create", target_type="pet_trait",
               target_id=trait.id, metadata={"label": trait.label})
    await db.commit()
    await db.refresh(trait)
    return _trait_out(trait, 0, admin.display_name)


@router.patch("/pet-traits/{trait_id}", response_model=PetTraitAdminOut)
async def update_pet_trait(
    trait_id: UUID,
    body: PetTraitUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(PetTrait).where(PetTrait.id == trait_id))
    trait = result.scalar_one_or_none()
    if not trait:
        raise HTTPException(status_code=404, detail="Trait not found")

    changes = body.model_dump(exclude_unset=True)
    old_label = trait.label

    if "label" in changes and changes["label"] != old_label:
        new_slug = trait_slug(changes["label"])
        conflict = await db.execute(
            select(PetTrait).where(PetTrait.slug == new_slug, PetTrait.id != trait_id)
        )
        if conflict.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Another trait with that name exists")
        trait.slug = new_slug

    for field, value in changes.items():
        setattr(trait, field, value)

    # A rename has to follow the label onto every pet carrying it, or those
    # pets keep a label the vocabulary no longer knows about.
    if trait.label != old_label:
        changes["pets_renamed"] = await rename_trait_on_pets(db, old_label, trait.label)
    # Rejecting pulls it off pets too — otherwise it stays visible everywhere
    # and only stops being *suggested*, which isn't what "reject" means.
    if changes.get("status") == "rejected":
        changes["pets_stripped"] = await remove_trait_from_pets(db, trait.label)

    await _log(db, actor_id=admin.id, action="pet_trait.update", target_type="pet_trait",
               target_id=trait_id, metadata=changes)
    await db.commit()
    await db.refresh(trait)

    counts = await trait_usage_counts(db)
    author = None
    if trait.created_by:
        author = (await db.execute(
            select(User.display_name).where(User.id == trait.created_by)
        )).scalar_one_or_none()
    return _trait_out(trait, counts.get(trait.label, 0), author)


@router.delete("/pet-traits/{trait_id}")
async def delete_pet_trait(
    trait_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a trait and strip the label from every pet using it.

    Unlike breeds (which 409 while in use) there's nothing to protect here —
    a trait is a tag, and removing the row without removing the label would
    leave pets carrying a word the vocabulary can no longer manage.
    """
    result = await db.execute(select(PetTrait).where(PetTrait.id == trait_id))
    trait = result.scalar_one_or_none()
    if not trait:
        raise HTTPException(status_code=404, detail="Trait not found")

    stripped = await remove_trait_from_pets(db, trait.label)
    await _log(db, actor_id=admin.id, action="pet_trait.delete", target_type="pet_trait",
               target_id=trait_id, metadata={"label": trait.label, "pets_stripped": stripped})
    await db.delete(trait)
    await db.commit()
    return {"detail": "Trait deleted", "pets_stripped": stripped}


# --- Parks: external-dataset import ---

@router.post("/parks/import-osm", response_model=ParkImportResponse)
async def import_parks_from_osm(
    body: ParkImportRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Pull pet parks from OpenStreetMap (via Overpass API) and upsert them.

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


@router.get("/parks/list", response_model=list[ParkOut])
async def list_parks_admin(
    response: Response,
    q: str = Query(default=""),
    source: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Paginated park list for admin management. Optionally filter by source."""
    filters = []
    if q:
        filters.append(Park.name.ilike(f"%{q}%"))
    if source:
        filters.append(Park.source == source)

    count_stmt = select(func.count()).select_from(Park)
    if filters:
        for f in filters:
            count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    stmt = select(Park).order_by(Park.created_at.desc()).offset(offset).limit(limit)
    if filters:
        for f in filters:
            stmt = stmt.where(f)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# --- Vets: external-dataset import (mirrors the parks import flow). ---

@router.post("/vets/import-osm", response_model=ParkImportResponse)
async def import_vets_from_osm(
    body: ParkImportRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Pull veterinary clinics from OpenStreetMap (Overpass) and upsert.

    Touches only `source='osm'` rows. `bbox` scopes the import; omit for
    worldwide. Returns the same shape as `/parks/import-osm`."""
    result = await import_osm_vets(db, bbox=body.bbox)
    db.add(AuditLog(
        actor_id=admin.id,
        action="vets.import_osm",
        target_type="vets",
        metadata_={
            "bbox": list(body.bbox) if body.bbox else None,
            **result.to_dict(),
        },
    ))
    await db.commit()
    return ParkImportResponse(**result.to_dict())


@router.get("/vets/import-history", response_model=list[ParkImportHistoryEntry])
async def list_vet_import_history(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Last 20 OSM vet imports from the audit log."""
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.action == "vets.import_osm")
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


@router.get("/vets/stats")
async def vet_source_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Breakdown of vets by data source."""
    result = await db.execute(
        select(Vet.source, func.count()).group_by(Vet.source)
    )
    by_source = {source or "unknown": count for source, count in result.all()}
    total = sum(by_source.values())
    return {"total": total, "by_source": by_source}


@router.get("/vets/list", response_model=list[VetOut])
async def list_vets_admin(
    response: Response,
    q: str = Query(default=""),
    source: str | None = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Paginated vet list for admin management. Optionally filter by source."""
    filters = []
    if q:
        filters.append(Vet.name.ilike(f"%{q}%"))
    if source:
        filters.append(Vet.source == source)

    count_stmt = select(func.count()).select_from(Vet)
    if filters:
        for f in filters:
            count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    stmt = select(Vet).order_by(Vet.created_at.desc()).offset(offset).limit(limit)
    if filters:
        for f in filters:
            stmt = stmt.where(f)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# --- QR tag registry ---

@router.post("/tags/generate")
async def generate_tags(
    body: TagGenerateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Mint a batch of unassigned QR tags for pre-printing."""
    codes = await generate_unique_codes(db, body.count)
    for c in codes:
        db.add(QRTag(code=c, created_by=admin.id))
    await _log(db, actor_id=admin.id, action="tag.generate", target_type="tag",
               metadata={"count": len(codes)})
    await db.commit()
    return {"codes": codes}


@router.get("/tags", response_model=list[AdminTagOut])
async def list_tags(
    response: Response,
    assigned: bool | None = Query(None),
    q: str = Query(default=""),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    base = select(QRTag)
    if assigned is True:
        base = base.where(QRTag.pet_id.is_not(None))
    elif assigned is False:
        base = base.where(QRTag.pet_id.is_(None))
    if q:
        base = base.where(QRTag.code.ilike(f"%{q.strip().upper()}%"))

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    rows = (await db.execute(
        base.order_by(QRTag.created_at.desc()).offset(offset).limit(limit)
    )).scalars().all()

    out: list[AdminTagOut] = []
    for t in rows:
        pet_name = owner_email = None
        if t.pet_id:
            pr = (await db.execute(
                select(Pet.name, User.email)
                .join(User, User.id == Pet.owner_id)
                .where(Pet.id == t.pet_id)
            )).first()
            if pr:
                pet_name, owner_email = pr
        out.append(AdminTagOut(
            code=t.code, pet_id=t.pet_id, pet_name=pet_name, owner_email=owner_email,
            assigned_at=t.assigned_at, created_at=t.created_at,
        ))
    return out


@router.post("/tags/{code}/assign", response_model=AdminTagOut)
async def admin_assign_tag(
    code: str,
    body: TagAssignRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    tag = (await db.execute(
        select(QRTag).where(QRTag.code == code.strip().upper())
    )).scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Unknown tag code")
    pet = (await db.execute(select(Pet).where(Pet.id == body.pet_id))).scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    tag.pet_id = pet.id
    tag.assigned_by = admin.id
    tag.assigned_at = datetime.now(timezone.utc)
    await _log(db, actor_id=admin.id, action="tag.assign", target_type="tag",
               metadata={"code": tag.code, "pet_id": str(pet.id)})
    await db.commit()
    owner_email = (await db.execute(select(User.email).where(User.id == pet.owner_id))).scalar()
    return AdminTagOut(
        code=tag.code, pet_id=tag.pet_id, pet_name=pet.name, owner_email=owner_email,
        assigned_at=tag.assigned_at, created_at=tag.created_at,
    )


# --- Helpers ---

async def _resolve_target_user(report: Report, db: AsyncSession) -> UUID | None:
    if report.target_type == "user":
        return report.target_id
    if report.target_type == "pet":
        result = await db.execute(select(Pet.owner_id).where(Pet.id == report.target_id))
        row = result.first()
        return row[0] if row else None
    if report.target_type == "photo":
        result = await db.execute(select(Photo.pet_id).where(Photo.id == report.target_id))
        row = result.first()
        if row:
            pet_result = await db.execute(select(Pet.owner_id).where(Pet.id == row[0]))
            dog_row = pet_result.first()
            return dog_row[0] if dog_row else None
    if report.target_type == "comment":
        result = await db.execute(
            select(Comment.author_id).where(Comment.id == report.target_id)
        )
        row = result.first()
        return row[0] if row else None
    return None
