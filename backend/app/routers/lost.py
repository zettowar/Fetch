import io
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from PIL import Image
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, contains_eager

from app.db import get_db
from app.deps import get_current_user
from app.limiter import limiter
from app.models.dog import Dog
from app.models.photo import Photo
from app.models.lost_report import (
    LostReport,
    LostReportPhoto,
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
from app.services.breed_display import breed_display
from app.services.lost_service import fuzz_coordinate, get_nearby_reports
from app.storage import generate_storage_key, get_storage

router = APIRouter()

SIGHTING_PHOTO_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
SIGHTING_PHOTO_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _sighting_to_out(sighting: LostReportSighting) -> SightingOut:
    storage = get_storage()
    return SightingOut(
        id=sighting.id,
        report_id=sighting.report_id,
        reporter_id=sighting.reporter_id,
        lat=sighting.lat,
        lng=sighting.lng,
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

    dog_name = None
    dog_breed = None
    dog_photo_url = None
    if report.dog:
        dog_name = report.dog.name
        dog_breed = breed_display(report.dog.mix_type, report.dog.breeds)
        if report.dog.primary_photo_id and report.dog.photos:
            primary = next(
                (p for p in report.dog.photos if p.id == report.dog.primary_photo_id),
                report.dog.photos[0] if report.dog.photos else None,
            )
            if primary:
                dog_photo_url = storage.url(primary.storage_key)

    sighting_count = len(report.sightings) if report.sightings else 0

    # Fuzz coordinates unless the viewer is the reporter
    lat = report.last_seen_lat
    lng = report.last_seen_lng
    if not is_owner and lat is not None and lng is not None:
        lat, lng = fuzz_coordinate(lat, lng, report.location_fuzz_m)

    return LostReportOut(
        id=report.id,
        reporter_id=report.reporter_id,
        dog_id=report.dog_id,
        kind=report.kind,
        status=report.status,
        last_seen_at=report.last_seen_at,
        last_seen_lat=lat,
        last_seen_lng=lng,
        location_fuzz_m=report.location_fuzz_m or 500,
        description=report.description,
        contact_method=report.contact_method,
        resolved_at=report.resolved_at,
        created_at=report.created_at,
        photos=photos,
        sighting_count=sighting_count,
        dog_name=dog_name,
        dog_breed=dog_breed,
        dog_photo_url=dog_photo_url,
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
    # Validate dog ownership if provided
    if body.dog_id:
        result = await db.execute(select(Dog).where(Dog.id == body.dog_id))
        dog = result.scalar_one_or_none()
        if not dog:
            raise HTTPException(status_code=404, detail="Dog not found")
        if body.kind == "missing" and dog.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Can only report your own dog as missing")

    # For 'found' reports, check account age >= 7 days
    if body.kind == "found":
        account_age = (datetime.now(timezone.utc) - user.created_at).days
        if account_age < 7 and not user.is_verified:
            raise HTTPException(
                status_code=403,
                detail="Account must be at least 7 days old to report a found dog",
            )

    report = LostReport(
        reporter_id=user.id,
        dog_id=body.dog_id,
        kind=body.kind,
        last_seen_at=body.last_seen_at,
        last_seen_lat=body.last_seen_lat,
        last_seen_lng=body.last_seen_lng,
        location_fuzz_m=body.location_fuzz_m,
        description=body.description,
        contact_method=body.contact_method,
        contact_value=body.contact_value,
    )
    db.add(report)
    await db.commit()

    # Re-fetch with relationships
    result = await db.execute(
        select(LostReport)
        .options(
            selectinload(LostReport.photos),
            selectinload(LostReport.sightings),
            selectinload(LostReport.dog).selectinload(Dog.photos),
            selectinload(LostReport.dog).selectinload(Dog.breeds),
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
        f_lat, f_lng = fuzz_coordinate(r.last_seen_lat, r.last_seen_lng, r.location_fuzz_m)
        dog_name = r.dog.name if r.dog else None
        dog_breed = breed_display(r.dog.mix_type, r.dog.breeds) if r.dog else None
        dog_photo_url = None
        if r.dog and r.dog.primary_photo_id and r.dog.photos:
            primary = next(
                (p for p in r.dog.photos if p.id == r.dog.primary_photo_id),
                r.dog.photos[0] if r.dog.photos else None,
            )
            if primary:
                dog_photo_url = storage.url(primary.storage_key)

        out.append(NearbyReportOut(
            id=r.id,
            kind=r.kind,
            status=r.status,
            fuzzed_lat=f_lat,
            fuzzed_lng=f_lng,
            location_fuzz_m=r.location_fuzz_m or 500,
            dog_name=dog_name,
            dog_breed=dog_breed,
            dog_photo_url=dog_photo_url,
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
            selectinload(LostReport.dog).selectinload(Dog.photos),
            selectinload(LostReport.dog).selectinload(Dog.breeds),
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
        .options(selectinload(LostReport.photos), selectinload(LostReport.sightings))
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
        .options(selectinload(LostReport.photos), selectinload(LostReport.sightings))
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
    await db.commit()
    await db.refresh(sighting)
    return _sighting_to_out(sighting)


@router.get("/reports/{report_id}/sightings", response_model=list[SightingOut])
async def list_sightings(
    report_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LostReportSighting)
        .where(LostReportSighting.report_id == report_id)
        .order_by(LostReportSighting.created_at.desc())
    )
    return [_sighting_to_out(s) for s in result.scalars().all()]


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
async def contact_reporter(
    report_id: UUID,
    body: ContactRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(LostReport).where(LostReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.reporter_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot contact yourself")
    if report.status != "open":
        raise HTTPException(status_code=400, detail="Report is not open")

    # PHASE3: Send actual notification/email to reporter
    # For now, log and return success
    import structlog
    logger = structlog.stdlib.get_logger()
    logger.info(
        "contact_relay",
        report_id=str(report_id),
        from_user=str(user.id),
        to_user=str(report.reporter_id),
    )

    return {"detail": "Contact request sent to reporter"}
