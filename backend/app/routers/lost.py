import io
from datetime import datetime, timezone
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.pet import Pet
from app.models.lost_report import (
    LostReport,
    LostReportSighting,
    LostReportSubscription,
)
from app.models.user import User
from app.schemas.lost_report import (
    ContactRequest,
    LostReportCreate,
    LostReportOut,
    LostReportPhotoOut,
    LostReportUpdate,
    NearbyReportOut,
    SightingCreate,
    SightingOut,
    SubscriptionCreate,
    SubscriptionOut,
    SubscriptionUpdate,
)
from app.config import settings
from app.services.breed_display import breed_display
from app.services.email import send_contact_relay_email
from app.services.lost_service import fuzz_coordinate, get_nearby_reports
from app.services.notify import notify
from app.services.moderation import check_image
from app.storage import generate_storage_key, get_storage

router = APIRouter()

SIGHTING_PHOTO_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
SIGHTING_PHOTO_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _sighting_to_out(
    sighting: LostReportSighting,
    *,
    is_owner: bool = False,
    fuzz_m: int = 500,
) -> SightingOut:
    storage = get_storage()
    # A sighting's coordinates are often the pet's exact last-known location.
    # Fuzz them for everyone except the report owner, mirroring report privacy.
    lat, lng = sighting.lat, sighting.lng
    if not is_owner:
        lat, lng = fuzz_coordinate(lat, lng, fuzz_m, seed=str(sighting.id))
    return SightingOut(
        id=sighting.id,
        report_id=sighting.report_id,
        reporter_id=sighting.reporter_id,
        lat=lat,
        lng=lng,
        seen_at=sighting.seen_at,
        note=sighting.note,
        photo_url=storage.url(sighting.photo_key) if sighting.photo_key else None,
        created_at=sighting.created_at,
    )


def _report_to_out(report: LostReport, is_owner: bool = False) -> LostReportOut:
    storage = get_storage()
    photos = [
        LostReportPhotoOut(
            id=p.id,
            storage_key=p.storage_key,
            url=storage.url(p.storage_key),
            width=p.width,
            height=p.height,
            content_type=p.content_type,
            created_at=p.created_at,
        )
        for p in (report.photos or [])
    ]

    pet_name = None
    pet_breed = None
    pet_photo_url = None
    if report.pet:
        pet_name = report.pet.name
        pet_breed = breed_display(report.pet.mix_type, report.pet.breeds, report.pet.species)
        approved = [
            p for p in (report.pet.photos or []) if p.moderation_status == "approved"
        ]
        if approved:
            primary = next(
                (p for p in approved if p.id == report.pet.primary_photo_id),
                approved[0],
            )
            pet_photo_url = storage.url(primary.storage_key)

    sighting_count = len(report.sightings) if report.sightings else 0

    # Fuzz coordinates unless the viewer is the reporter
    lat = report.last_seen_lat
    lng = report.last_seen_lng
    if not is_owner and lat is not None and lng is not None:
        lat, lng = fuzz_coordinate(
            lat, lng, report.location_fuzz_m, seed=str(report.id)
        )

    return LostReportOut(
        id=report.id,
        reporter_id=report.reporter_id,
        pet_id=report.pet_id,
        kind=report.kind,
        status=report.status,
        last_seen_at=report.last_seen_at,
        last_seen_lat=lat,
        last_seen_lng=lng,
        location_fuzz_m=report.location_fuzz_m or 500,
        description=report.description,
        contact_method=report.contact_method,
        is_public=report.is_public,
        resolved_at=report.resolved_at,
        created_at=report.created_at,
        photos=photos,
        sighting_count=sighting_count,
        pet_name=pet_name,
        pet_breed=pet_breed,
        pet_photo_url=pet_photo_url,
    )


# --- Reports CRUD ---

@router.post("/reports", response_model=LostReportOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
async def create_report(
    request: Request,
    body: LostReportCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate pet ownership if provided
    if body.pet_id:
        result = await db.execute(select(Pet).where(Pet.id == body.pet_id))
        pet = result.scalar_one_or_none()
        if not pet:
            raise HTTPException(status_code=404, detail="Pet not found")
        if body.kind == "missing" and pet.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Can only report your own pet as missing")

    # For 'found' reports, check account age >= 7 days
    if body.kind == "found":
        account_age = (datetime.now(timezone.utc) - user.created_at).days
        if account_age < 7 and not user.is_verified:
            raise HTTPException(
                status_code=403,
                detail="Account must be at least 7 days old to report a found pet",
            )

    report = LostReport(
        reporter_id=user.id,
        pet_id=body.pet_id,
        kind=body.kind,
        last_seen_at=body.last_seen_at,
        last_seen_lat=body.last_seen_lat,
        last_seen_lng=body.last_seen_lng,
        location_fuzz_m=body.location_fuzz_m,
        description=body.description,
        contact_method=body.contact_method,
        contact_value=body.contact_value,
        is_public=body.is_public,
    )
    db.add(report)
    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(LostReport)
        .options(
            selectinload(LostReport.photos),
            selectinload(LostReport.sightings),
            selectinload(LostReport.pet).selectinload(Pet.photos),
            selectinload(LostReport.pet).selectinload(Pet.breeds),
        )
        .where(LostReport.id == report.id)
    )
    report = result.scalar_one()

    if report.last_seen_lat and report.last_seen_lng:
        from app.tasks.lost_alerts import send_proximity_alerts
        send_proximity_alerts.delay(str(report.id))

    return _report_to_out(report, is_owner=True)


@router.get("/reports/nearby", response_model=list[NearbyReportOut])
async def nearby_reports(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(10.0, ge=1, le=100),
    kind: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reports = await get_nearby_reports(db, lat, lng, radius_km, kind=kind)

    storage = get_storage()
    out = []
    for r in reports:
        f_lat, f_lng = fuzz_coordinate(
            r.last_seen_lat, r.last_seen_lng, r.location_fuzz_m, seed=str(r.id)
        )
        pet_name = r.pet.name if r.pet else None
        pet_breed = breed_display(r.pet.mix_type, r.pet.breeds, r.pet.species) if r.pet else None
        pet_photo_url = None
        if r.pet:
            approved = [
                p for p in (r.pet.photos or []) if p.moderation_status == "approved"
            ]
            if approved:
                primary = next(
                    (p for p in approved if p.id == r.pet.primary_photo_id),
                    approved[0],
                )
                pet_photo_url = storage.url(primary.storage_key)

        out.append(NearbyReportOut(
            id=r.id,
            kind=r.kind,
            status=r.status,
            fuzzed_lat=f_lat,
            fuzzed_lng=f_lng,
            location_fuzz_m=r.location_fuzz_m or 500,
            pet_name=pet_name,
            pet_breed=pet_breed,
            pet_photo_url=pet_photo_url,
            description=r.description,
            created_at=r.created_at,
        ))
    return out


@router.get("/reports/{report_id}", response_model=LostReportOut)
async def get_report(
    report_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LostReport)
        .options(
            selectinload(LostReport.photos),
            selectinload(LostReport.sightings),
            selectinload(LostReport.pet).selectinload(Pet.photos),
            selectinload(LostReport.pet).selectinload(Pet.breeds),
        )
        .where(LostReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    is_owner = report.reporter_id == user.id
    return _report_to_out(report, is_owner=is_owner)


@router.patch("/reports/{report_id}", response_model=LostReportOut)
async def update_report(
    report_id: UUID,
    body: LostReportUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LostReport)
        .options(selectinload(LostReport.photos), selectinload(LostReport.sightings))
        .where(LostReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.reporter_id != user.id:
        raise HTTPException(status_code=403, detail="Not your report")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(report, field, value)

    await db.commit()
    result = await db.execute(
        select(LostReport)
        .options(
            selectinload(LostReport.photos),
            selectinload(LostReport.sightings),
            selectinload(LostReport.pet).selectinload(Pet.photos),
            selectinload(LostReport.pet).selectinload(Pet.breeds),
        )
        .where(LostReport.id == report_id)
    )
    report = result.scalar_one()
    return _report_to_out(report, is_owner=True)


@router.post("/reports/{report_id}/resolve", response_model=LostReportOut)
async def resolve_report(
    report_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LostReport)
        .options(selectinload(LostReport.photos), selectinload(LostReport.sightings))
        .where(LostReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.reporter_id != user.id:
        raise HTTPException(status_code=403, detail="Not your report")

    report.status = "resolved"
    report.resolved_at = datetime.now(timezone.utc)
    report.resolved_by = user.id
    await db.commit()

    result = await db.execute(
        select(LostReport)
        .options(
            selectinload(LostReport.photos),
            selectinload(LostReport.sightings),
            selectinload(LostReport.pet).selectinload(Pet.photos),
            selectinload(LostReport.pet).selectinload(Pet.breeds),
        )
        .where(LostReport.id == report_id)
    )
    report = result.scalar_one()
    return _report_to_out(report, is_owner=True)


# --- Sightings ---

@router.post(
    "/reports/{report_id}/sightings",
    response_model=SightingOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("30/hour")
async def add_sighting(
    request: Request,
    report_id: UUID,
    lat: float = Form(...),
    lng: float = Form(...),
    seen_at: datetime | None = Form(None),
    note: str | None = Form(None),
    photo: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    body = SightingCreate(lat=lat, lng=lng, seen_at=seen_at, note=note)

    result = await db.execute(select(LostReport).where(LostReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.status != "open":
        raise HTTPException(status_code=400, detail="Report is not open")

    photo_key: str | None = None
    photo_content_type: str | None = None
    if photo is not None and photo.filename:
        data = await photo.read()
        if len(data) > SIGHTING_PHOTO_MAX_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 10MB)")
        try:
            img = Image.open(io.BytesIO(data))
            img.verify()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image file")
        detected = f"image/{img.format.lower()}" if img.format else photo.content_type
        if detected not in SIGHTING_PHOTO_ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP are allowed")
        # Sighting photos are public; reject anything the moderator doesn't
        # approve (sightings have no hidden/flagged review state).
        mod_result = await check_image(data)
        if mod_result.status != "approved":
            # check_image fails closed, so a moderation outage lands here too —
            # surface that as retryable rather than as a content rejection.
            if (mod_result.reason or "").endswith("_fallback"):
                raise HTTPException(
                    status_code=503,
                    detail="Image checks are temporarily unavailable — please try again shortly",
                )
            raise HTTPException(
                status_code=400, detail="Image rejected by content moderation"
            )
        photo_content_type = detected
        photo_key = generate_storage_key(detected)
        storage = get_storage()
        await storage.put(photo_key, data, detected)

    sighting = LostReportSighting(
        report_id=report_id,
        reporter_id=user.id,
        lat=body.lat,
        lng=body.lng,
        seen_at=body.seen_at,
        note=body.note,
        photo_key=photo_key,
        photo_content_type=photo_content_type,
    )
    db.add(sighting)
    if report.reporter_id != user.id:
        await notify(
            db, report.reporter_id,
            type="sighting",
            title="New sighting on your lost-pet report",
            body=body.note[:120] if body.note else None,
            link=f"/app/lost/{report_id}",
        )
    await db.commit()
    await db.refresh(sighting)
    is_owner = report.reporter_id == user.id
    return _sighting_to_out(
        sighting, is_owner=is_owner, fuzz_m=report.location_fuzz_m or 500
    )


@router.get("/reports/{report_id}/sightings", response_model=list[SightingOut])
async def list_sightings(
    report_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    report_result = await db.execute(
        select(LostReport).where(LostReport.id == report_id)
    )
    report = report_result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    is_owner = report.reporter_id == user.id
    fuzz_m = report.location_fuzz_m or 500

    result = await db.execute(
        select(LostReportSighting)
        .where(LostReportSighting.report_id == report_id)
        .order_by(LostReportSighting.created_at.desc())
    )
    return [
        _sighting_to_out(s, is_owner=is_owner, fuzz_m=fuzz_m)
        for s in result.scalars().all()
    ]


# --- Subscriptions ---

@router.post("/subscriptions", response_model=SubscriptionOut, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    body: SubscriptionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check for existing subscription
    existing = await db.execute(
        select(LostReportSubscription).where(LostReportSubscription.user_id == user.id)
    )
    sub = existing.scalar_one_or_none()
    if sub:
        # Update existing
        sub.home_lat = body.home_lat
        sub.home_lng = body.home_lng
        sub.radius_km = body.radius_km
        sub.enabled = True
        await db.commit()
        await db.refresh(sub)
        return sub

    sub = LostReportSubscription(
        user_id=user.id,
        home_lat=body.home_lat,
        home_lng=body.home_lng,
        radius_km=body.radius_km,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.get("/subscriptions/mine", response_model=SubscriptionOut | None)
async def get_my_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LostReportSubscription).where(LostReportSubscription.user_id == user.id)
    )
    return result.scalar_one_or_none()


@router.patch("/subscriptions/mine", response_model=SubscriptionOut)
async def update_subscription(
    body: SubscriptionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LostReportSubscription).where(LostReportSubscription.user_id == user.id)
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(sub, field, value)

    await db.commit()
    await db.refresh(sub)
    return sub


# --- Contact relay ---

@router.post("/reports/{report_id}/contact")
@limiter.limit("10/hour")
async def contact_reporter(
    request: Request,
    report_id: UUID,
    body: ContactRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Relay a message to the reporter by email (their address stays hidden;
    replies go to the sender via Reply-To)."""
    result = await db.execute(
        select(LostReport)
        .options(selectinload(LostReport.pet))
        .where(LostReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.reporter_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot contact yourself")
    if report.status != "open":
        raise HTTPException(status_code=400, detail="Report is not open")

    reporter_result = await db.execute(
        select(User).where(User.id == report.reporter_id, User.is_active == True)  # noqa: E712
    )
    reporter = reporter_result.scalar_one_or_none()
    if not reporter:
        raise HTTPException(status_code=400, detail="Reporter is no longer reachable")
    from app.services.blocks import is_blocked_between
    if await is_blocked_between(db, user.id, reporter.id):
        # Same message as an unreachable reporter — a block is not disclosed.
        raise HTTPException(status_code=400, detail="Reporter is no longer reachable")

    # Checked last so validation errors (404/400) stay meaningful even when
    # email is unconfigured. Without a provider the relay is honestly down —
    # no more pretending the message was delivered.
    if not settings.RESEND_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Contact relay is unavailable — email delivery is not configured",
        )

    report_title = (
        report.pet.name if report.pet else (report.description or "your report")[:60]
    )
    background_tasks.add_task(
        send_contact_relay_email,
        reporter.email,
        sender_name=user.display_name,
        sender_email=user.email,
        report_title=report_title,
        message=body.message,
    )

    import structlog
    logger = structlog.stdlib.get_logger()
    logger.info(
        "contact_relay",
        report_id=str(report_id),
        from_user=str(user.id),
        to_user=str(report.reporter_id),
    )

    return {"detail": "Contact request sent to reporter"}
