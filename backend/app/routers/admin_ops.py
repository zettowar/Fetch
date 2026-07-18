"""Admin operations that post-date the original admin router: privileged user
actions, rescue oversight, donation refunds, broadcast comms, runtime settings,
and background-job observability. Mounted at the same /admin prefix.

Read/moderation gates use require_staff; anything sensitive uses require_admin.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.db import get_db
from app.deps import STAFF_ROLES, require_admin, require_staff
from app.models.adoption import AdoptionInquiry
from app.models.announcement import Announcement
from app.models.app_setting import AppSetting
from app.models.audit_log import AuditLog
from app.models.donation import Donation
from app.models.rescue import RescueProfile
from app.models.user import EmailVerificationToken, PasswordResetToken, User
from app.routers.admin import DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, _log
from app.schemas.admin_ops import (
    AdminUserEdit,
    AdoptionInquiryOut,
    AnnouncementCreate,
    AnnouncementOut,
    ImpersonateResponse,
    RescueAdminEdit,
    RescueStatusUpdate,
    SettingOut,
    SettingUpdate,
    SystemJobsOut,
)
from app.schemas.rescue import RescueProfileOut
from app.security import (
    create_access_token,
    generate_reset_token,
    hash_reset_token,
)
from app.services import settings_service
from app.services.email import send_password_reset_email, send_verification_email

logger = structlog.get_logger()
router = APIRouter()


# --- Privileged user actions ---

@router.patch("/users/{user_id}", response_model=dict)
async def edit_user(
    user_id: UUID,
    body: AdminUserEdit,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Edit a user's display name and/or email. Changing the email clears the
    verified flag (they must re-verify the new address)."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    changes: dict = {}
    if body.display_name is not None and body.display_name != user.display_name:
        changes["display_name"] = body.display_name
        user.display_name = body.display_name
    if body.email is not None and body.email.lower() != user.email:
        user.email = body.email.lower()
        user.is_verified = False
        changes["email"] = user.email

    if not changes:
        return {"detail": "No changes"}

    try:
        await _log(db, actor_id=admin.id, action="user.edit", target_type="user",
                   target_id=user_id, metadata=changes)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="That email is already in use")
    return {"detail": "User updated", "changes": changes}


@router.post("/users/{user_id}/resend-verification", response_model=dict)
async def admin_resend_verification(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="User is already verified")

    # Invalidate outstanding tokens, mint a fresh one (mirrors auth._issue_...).
    existing = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user.id,
            EmailVerificationToken.used == False,  # noqa: E712
        )
    )
    for old in existing.scalars().all():
        old.used = True
    raw = generate_reset_token()
    db.add(EmailVerificationToken(
        user_id=user.id, token_hash=hash_reset_token(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.VERIFICATION_TOKEN_TTL_HOURS),
    ))
    await _log(db, actor_id=admin.id, action="user.resend_verification",
               target_type="user", target_id=user_id, metadata={"email": user.email})
    await db.commit()

    delivered = await send_verification_email(user.email, raw)
    return {"detail": "Verification email sent" if delivered else
            "Verification token issued (email provider not configured)"}


@router.post("/users/{user_id}/send-password-reset", response_model=dict)
async def admin_send_password_reset(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,  # noqa: E712
        )
    )
    for old in existing.scalars().all():
        old.used = True
    raw = generate_reset_token()
    db.add(PasswordResetToken(
        user_id=user.id, token_hash=hash_reset_token(raw),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_TTL_MIN),
    ))
    await _log(db, actor_id=admin.id, action="user.send_password_reset",
               target_type="user", target_id=user_id, metadata={"email": user.email})
    await db.commit()

    delivered = await send_password_reset_email(user.email, raw)
    return {"detail": "Password reset email sent" if delivered else
            "Reset token issued (email provider not configured)"}


@router.post("/users/{user_id}/mark-verified", response_model=dict)
async def admin_mark_verified(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_verified = True
    await _log(db, actor_id=admin.id, action="user.mark_verified",
               target_type="user", target_id=user_id, metadata={"email": user.email})
    await db.commit()
    return {"detail": "User marked verified"}


@router.post("/users/{user_id}/set-role", response_model=dict)
async def set_user_role(
    user_id: UUID,
    role: str = Query(...),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Assign user | moderator | admin. The generalized form of promote/demote,
    needed so the moderator tier is actually reachable from the UI."""
    if role not in ("user", "moderator", "admin"):
        raise HTTPException(status_code=400, detail="role must be user, moderator, or admin")
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    if user.role == "rescue":
        raise HTTPException(status_code=400, detail="Rescue accounts can't be reassigned")
    prev = user.role
    user.role = role
    await _log(db, actor_id=admin.id, action="user.set_role", target_type="user",
               target_id=user_id, metadata={"from": prev, "to": role, "email": user.email})
    await db.commit()
    return {"detail": f"Role set to {role}"}


@router.post("/users/{user_id}/impersonate", response_model=ImpersonateResponse)
async def impersonate_user(
    user_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Issue a short-lived access token to act as a user for support. Refuses
    staff targets (no lateral/elevation), and every use is audit-logged. No
    refresh token is minted, so the session simply expires (~15 min)."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You are already yourself")
    if user.role in STAFF_ROLES:
        raise HTTPException(status_code=400, detail="Cannot impersonate another staff member")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Cannot impersonate a suspended user")

    token = create_access_token(str(user.id))
    await _log(db, actor_id=admin.id, action="user.impersonate", target_type="user",
               target_id=user_id, metadata={"email": user.email})
    await db.commit()
    return ImpersonateResponse(
        access_token=token, user_id=user.id, display_name=user.display_name,
    )


# --- Rescue oversight ---

@router.post("/rescue-profiles/{profile_id}/set-status", response_model=RescueProfileOut)
async def set_rescue_status(
    profile_id: UUID,
    body: RescueStatusUpdate,
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Set a rescue's status at any time — unlike the one-shot /review, this
    can re-review or revoke an already-approved rescue."""
    profile = (await db.execute(
        select(RescueProfile).where(RescueProfile.id == profile_id)
    )).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue profile not found")
    prev = profile.status
    profile.status = body.status
    profile.review_note = body.note
    profile.reviewed_by = admin.id
    profile.reviewed_at = datetime.now(timezone.utc)
    await _log(db, actor_id=admin.id, action="rescue.set_status", target_type="rescue_profile",
               target_id=profile_id, metadata={"from": prev, "to": body.status, "org_name": profile.org_name})
    await db.commit()
    await db.refresh(profile)
    return profile


@router.patch("/rescue-profiles/{profile_id}", response_model=RescueProfileOut)
async def edit_rescue_profile(
    profile_id: UUID,
    body: RescueAdminEdit,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    profile = (await db.execute(
        select(RescueProfile).where(RescueProfile.id == profile_id)
    )).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue profile not found")
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        setattr(profile, field, value)
    await _log(db, actor_id=admin.id, action="rescue.edit", target_type="rescue_profile",
               target_id=profile_id, metadata={"fields": list(changes.keys())})
    await db.commit()
    await db.refresh(profile)
    return profile


@router.get("/adoption-inquiries", response_model=list[AdoptionInquiryOut])
async def list_adoption_inquiries(
    response: Response,
    rescue_id: UUID | None = Query(None),
    status_filter: str = Query("all", alias="status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Cross-rescue view of adoption inquiries (rescues only see their own)."""
    filters = []
    if rescue_id:
        filters.append(AdoptionInquiry.rescue_id == rescue_id)
    if status_filter != "all":
        filters.append(AdoptionInquiry.status == status_filter)

    count_stmt = select(func.count()).select_from(AdoptionInquiry)
    for f in filters:
        count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    stmt = (
        select(AdoptionInquiry, RescueProfile.org_name)
        .join(RescueProfile, RescueProfile.id == AdoptionInquiry.rescue_id)
        .order_by(AdoptionInquiry.created_at.desc())
        .offset(offset).limit(limit)
    )
    for f in filters:
        stmt = stmt.where(f)
    rows = (await db.execute(stmt)).all()
    return [
        AdoptionInquiryOut(
            id=inq.id, rescue_id=inq.rescue_id, rescue_name=org_name,
            pet_id=inq.pet_id, inquirer_id=inq.inquirer_id, name=inq.name,
            email=inq.email, phone=inq.phone, message=inq.message,
            status=inq.status, created_at=inq.created_at,
        )
        for inq, org_name in rows
    ]


# --- Donation refunds ---

@router.post("/donations/{donation_id}/refund", response_model=dict)
async def refund_donation(
    donation_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.services import stripe_service

    if not stripe_service.stripe_enabled():
        raise HTTPException(status_code=503, detail="Stripe is not configured")

    donation = (await db.execute(
        select(Donation).where(Donation.id == donation_id)
    )).scalar_one_or_none()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.status != "succeeded":
        raise HTTPException(status_code=400, detail=f"Cannot refund a {donation.status} donation")
    if not donation.stripe_payment_intent_id:
        raise HTTPException(status_code=400, detail="Donation has no payment to refund")

    try:
        await stripe_service.create_refund(donation.stripe_payment_intent_id)
    except Exception as exc:  # noqa: BLE001
        logger.warning("refund_failed", donation_id=str(donation_id), error=str(exc))
        raise HTTPException(status_code=502, detail="Stripe refund failed")

    # Reflect immediately; the charge.refunded webhook is idempotent.
    donation.status = "refunded"
    await _log(db, actor_id=admin.id, action="donation.refund", target_type="donation",
               target_id=donation_id, metadata={"amount_cents": donation.amount_cents,
                                                "recipient": donation.recipient_name})
    await db.commit()
    return {"detail": "Refund issued", "amount_cents": donation.amount_cents}


# --- Broadcast announcements ---

@router.post("/announcements", response_model=AnnouncementOut, status_code=201)
async def create_announcement(
    body: AnnouncementCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a broadcast and kick off async fan-out to its segment."""
    ann = Announcement(
        title=body.title, body=body.body, link=body.link,
        segment=body.segment, send_email=body.send_email, sent_by=admin.id,
    )
    db.add(ann)
    await db.flush()
    await _log(db, actor_id=admin.id, action="announcement.send", target_type="announcement",
               target_id=ann.id, metadata={"segment": body.segment, "email": body.send_email})
    await db.commit()
    await db.refresh(ann)

    # Dispatch the fan-out. If the broker is unreachable, the announcement row
    # still exists and can be re-dispatched; surface a soft warning.
    try:
        from app.tasks.announcements import dispatch_announcement_task
        dispatch_announcement_task.delay(str(ann.id))
    except Exception as exc:  # noqa: BLE001
        logger.warning("announcement_dispatch_enqueue_failed", id=str(ann.id), error=str(exc))
    return ann


@router.get("/announcements", response_model=list[AnnouncementOut])
async def list_announcements(
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(Announcement).order_by(Announcement.created_at.desc()).limit(limit)
    )).scalars().all()
    return list(rows)


# --- Runtime settings / feature flags ---

@router.get("/settings", response_model=list[SettingOut])
async def get_settings(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    return await settings_service.all_settings(db)


@router.put("/settings/{key}", response_model=SettingOut)
async def put_setting(
    key: str,
    body: SettingUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if key not in settings_service.DEFAULTS:
        raise HTTPException(status_code=404, detail="Unknown setting key")
    row = (await db.execute(
        select(AppSetting).where(AppSetting.key == key)
    )).scalar_one_or_none()
    if row is None:
        row = AppSetting(key=key, value=body.value, updated_by=admin.id)
        db.add(row)
    else:
        row.value = body.value
        row.updated_by = admin.id
    await _log(db, actor_id=admin.id, action="setting.update", target_type="setting",
               target_id=None, metadata={"key": key, "value": body.value})
    await db.commit()
    settings_service.invalidate_cache()

    default, desc = settings_service.DEFAULTS[key]
    return SettingOut(key=key, value=body.value, default=default, description=desc,
                      overridden=body.value is not None)


# --- Background-job observability ---

@router.get("/system/jobs", response_model=SystemJobsOut)
async def system_jobs(
    admin: User = Depends(require_admin),
):
    """Worker health: which app tasks are registered + broker queue depth.

    The scheduled jobs themselves (and their per-row registered status) now live
    in the editable ``periodic_tasks`` table — see the /admin/scheduled-tasks
    endpoints — so this endpoint no longer reflects the static beat schedule."""
    import app.tasks  # noqa: F401 — force task modules to import & self-register
    from app.worker import celery_app

    registered = {name for name in celery_app.tasks if name.startswith("app.tasks")}

    queue_depth: int | None = None
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(settings.CELERY_BROKER_URL)
        queue_depth = await client.llen("celery")
        await client.aclose()
    except Exception as exc:  # noqa: BLE001
        logger.warning("queue_depth_failed", error=str(exc))

    return SystemJobsOut(
        broker_queue_depth=queue_depth,
        registered_tasks=sorted(registered),
    )
