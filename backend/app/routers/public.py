"""Unauthenticated read-only endpoints for the public share pages.

Deliberately narrow: a pet's share page shows the pet (never the owner's
identity), and only while the owner leaves the pet public (pets.is_public,
on by default, toggleable in the pet editor).
"""
from datetime import date
from typing import Literal
from uuid import UUID

import structlog
from fastapi import (
    APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response,
)
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import get_db
from app.limiter import limiter
from app.security import decode_unsubscribe_token
from app.services.email import send_tag_found_email
from app.models.beta import InviteCode, WaitlistEntry
from app.models.news import NewsPost
from app.models.notification import NotificationPreference
from app.models.pet import Pet
from app.models.qr_tag import QRTag
from app.models.rescue import RescueProfile
from app.models.user import User
from app.models.weekly_winner import WeeklyWinner
from app.schemas.news import NewsPostOut
from app.services.breed_display import breed_display
from app.services.pet_serializer import display_photo_url
from app.storage import get_storage

logger = structlog.stdlib.get_logger()

router = APIRouter()


class SiteBannerOut(BaseModel):
    banner: str = ""


@router.get("/banner", response_model=SiteBannerOut)
async def site_banner(db: AsyncSession = Depends(get_db)):
    """Admin-set maintenance/announcement banner, shown to everyone. Empty
    string = no banner. Polled by the app shell."""
    from app.services import settings_service

    text = await settings_service.get_setting(db, "maintenance_banner")
    return SiteBannerOut(banner=text or "")


@router.get("/flags")
async def public_flags(db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    """Client-facing UI feature flags (Explore section gating). Unauthenticated
    so the app shell can grey out sections regardless of auth state."""
    from app.services import settings_service

    return {
        key: bool(await settings_service.get_setting(db, key))
        for key in settings_service.PUBLIC_FLAG_KEYS
    }


@router.get("/news", response_model=list[NewsPostOut])
async def public_news(db: AsyncSession = Depends(get_db)):
    """Published news articles for the marketing site, newest first."""
    result = await db.execute(
        select(NewsPost)
        .where(NewsPost.is_published == True)  # noqa: E712
        .order_by(NewsPost.published_at.desc())
    )
    return list(result.scalars().all())


class PublicPetOut(BaseModel):
    id: UUID
    name: str
    species: str = "dog"
    breed_display: str | None = None
    birthday: date | None = None
    bio: str | None = None
    traits: list[str] = []
    photo_urls: list[str] = []
    primary_photo_url: str | None = None
    adoptable: bool = False
    adopted: bool = False
    rescue_name: str | None = None
    crown_weeks: list[date] = []


class PublicTopPetOut(BaseModel):
    pet_id: UUID
    pet_name: str
    species: str = "dog"
    week_bucket: date
    score: int
    photo_url: str | None = None


def _serialize_public_pet(
    pet: Pet, *, rescue_name: str | None, crown_weeks: list | None = None
) -> PublicPetOut:
    """Build a PublicPetOut from a Pet with photos/breeds eager-loaded."""
    storage = get_storage()
    approved = [p for p in pet.photos if p.moderation_status == "approved"]
    return PublicPetOut(
        id=pet.id,
        name=pet.name,
        species=pet.species,
        breed_display=breed_display(pet.mix_type, pet.breeds, pet.species),
        birthday=pet.birthday,
        bio=pet.bio,
        traits=pet.traits or [],
        photo_urls=[storage.url(p.storage_key) for p in approved],
        primary_photo_url=display_photo_url(pet),
        adoptable=rescue_name is not None and pet.adopted_at is None,
        adopted=pet.adopted_at is not None,
        rescue_name=rescue_name,
        crown_weeks=crown_weeks or [],
    )


@router.get("/pets/{pet_id}", response_model=PublicPetOut)
async def public_pet(pet_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Pet)
        .options(
            selectinload(Pet.photos),
            selectinload(Pet.breeds),
            selectinload(Pet.owner).selectinload(User.rescue_profile),
        )
        .where(Pet.id == pet_id, Pet.is_active == True, Pet.is_public == True)  # noqa: E712
    )
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")

    owner = pet.owner
    rescue_name = None
    if owner is not None and owner.rescue_profile and owner.rescue_profile.status == "approved":
        rescue_name = owner.rescue_profile.org_name

    crowns = await db.execute(
        select(WeeklyWinner.week_bucket)
        .where(WeeklyWinner.pet_id == pet.id)
        .order_by(WeeklyWinner.week_bucket.desc())
    )
    return _serialize_public_pet(
        pet, rescue_name=rescue_name, crown_weeks=list(crowns.scalars().all())
    )


class PublicRescueOut(BaseModel):
    id: UUID
    slug: str | None = None
    org_name: str
    description: str
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    website: str | None = None
    donation_url: str | None = None
    donations_enabled: bool = False
    logo_url: str | None = None
    cover_url: str | None = None
    pets: list[PublicPetOut] = []


_IMAGE_MEDIA_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


@router.get("/rescues/images/{key}")
async def public_rescue_image(key: str, db: AsyncSession = Depends(get_db)):
    """Serve a rescue logo/cover — but only if `key` is actually a rescue image
    (never an arbitrary storage key)."""
    exists = (await db.execute(
        select(RescueProfile.id).where(
            or_(RescueProfile.logo_key == key, RescueProfile.cover_key == key)
        )
    )).first()
    if exists is None:
        raise HTTPException(status_code=404, detail="Image not found")
    storage = get_storage()
    try:
        data = await storage.get(key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found")
    ext = key.rsplit(".", 1)[-1].lower() if "." in key else ""
    return Response(content=data, media_type=_IMAGE_MEDIA_TYPES.get(ext, "application/octet-stream"))


@router.get("/rescues/{slug}", response_model=PublicRescueOut)
async def public_rescue(slug: str, db: AsyncSession = Depends(get_db)):
    """The rescue's public 'website' page — approved + is_public only."""
    result = await db.execute(
        select(RescueProfile).where(
            RescueProfile.slug == slug,
            RescueProfile.status == "approved",
            RescueProfile.is_public == True,  # noqa: E712
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Rescue not found")

    pets_result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.photos), selectinload(Pet.breeds))
        .where(
            Pet.owner_id == profile.user_id,
            Pet.is_active == True,  # noqa: E712
            Pet.is_public == True,  # noqa: E712
            Pet.adopted_at.is_(None),
        )
        .order_by(Pet.created_at.desc())
    )
    pets = [
        _serialize_public_pet(p, rescue_name=profile.org_name)
        for p in pets_result.scalars().all()
    ]

    return PublicRescueOut(
        id=profile.id,
        slug=profile.slug,
        org_name=profile.org_name,
        description=profile.description,
        location=profile.location,
        lat=profile.lat,
        lng=profile.lng,
        website=profile.website,
        donation_url=profile.donation_url,
        donations_enabled=profile.donations_enabled,
        logo_url=profile.logo_url,
        cover_url=profile.cover_url,
        pets=pets,
    )


class PublicTagOut(BaseModel):
    """Resolution for a scanned QR tag."""
    assigned: bool = False
    pet: PublicPetOut | None = None


@router.get("/tags/{code}", response_model=PublicTagOut)
async def public_tag(code: str, db: AsyncSession = Depends(get_db)):
    """Resolve a scanned tag code to its pet's public profile. Unknown code →
    404; unassigned → assigned:false; assigned but private/removed → pet:null."""
    tag = (
        await db.execute(select(QRTag).where(QRTag.code == code.strip().upper()))
    ).scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Unknown tag")
    if tag.pet_id is None:
        return PublicTagOut(assigned=False, pet=None)

    pet = (await db.execute(
        select(Pet)
        .options(
            selectinload(Pet.photos),
            selectinload(Pet.breeds),
            selectinload(Pet.owner).selectinload(User.rescue_profile),
        )
        .where(Pet.id == tag.pet_id, Pet.is_active == True, Pet.is_public == True)  # noqa: E712
    )).scalar_one_or_none()
    if not pet:
        return PublicTagOut(assigned=True, pet=None)

    owner = pet.owner
    rescue_name = None
    if owner is not None and owner.rescue_profile and owner.rescue_profile.status == "approved":
        rescue_name = owner.rescue_profile.org_name
    return PublicTagOut(assigned=True, pet=_serialize_public_pet(pet, rescue_name=rescue_name))


class TagContactRequest(BaseModel):
    """A finder's message to the owner of a scanned collar tag."""
    finder_name: str = Field(..., min_length=1, max_length=80)
    finder_contact: str = Field(..., min_length=3, max_length=120)
    message: str = Field(..., min_length=1, max_length=1000)

    @field_validator("finder_name", "finder_contact", "message")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field is required")
        return v


@router.post("/tags/{code}/contact")
# Unauthenticated and it sends mail, so it is rate limited hard. Keyed on the
# caller's IP by the limiter; the tag code itself is the other half of the
# defence — you cannot enumerate owners without physically having a tag.
@limiter.limit("5/hour")
async def contact_tag_owner(
    code: str,
    request: Request,
    body: TagContactRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Relay a "I found this pet" message from a finder to the pet's owner.

    The point of a collar tag: a stranger scans it and can tell the owner the
    pet is safe. The owner's address is never exposed — the finder's own
    contact details ride in the body and in Reply-To, mirroring the lost-report
    relay in `lost.py`.
    """
    tag = (
        await db.execute(select(QRTag).where(QRTag.code == code.strip().upper()))
    ).scalar_one_or_none()
    if not tag or tag.pet_id is None:
        raise HTTPException(status_code=404, detail="Unknown tag")

    pet = (await db.execute(
        select(Pet)
        .options(selectinload(Pet.owner))
        .where(Pet.id == tag.pet_id, Pet.is_active == True)  # noqa: E712
    )).scalar_one_or_none()
    # Note: no is_public check. Hiding the share page means "don't list me",
    # not "don't tell me my pet was found" — the tag exists precisely for this.
    if not pet or pet.owner is None or not pet.owner.is_active:
        raise HTTPException(status_code=404, detail="Unknown tag")

    # Checked last so the 404s above stay meaningful when email is unconfigured,
    # matching the lost-report relay's ordering.
    if not settings.RESEND_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Contact is unavailable — email delivery is not configured",
        )

    background_tasks.add_task(
        send_tag_found_email,
        pet.owner.email,
        pet_name=pet.name,
        finder_name=body.finder_name,
        finder_contact=body.finder_contact,
        message=body.message,
        tag_code=tag.code,
    )
    logger.info("tag_contact", tag_code=tag.code, pet_id=str(pet.id))
    return {"detail": f"Message sent to {pet.name}'s owner"}


class UnsubscribeOut(BaseModel):
    status: Literal["ok", "invalid"]
    list_name: str | None = None
    label: str | None = None


# Which preference each mailing list maps onto. `digest` is a mode rather than
# a boolean, so it is special-cased below.
_UNSUB_LISTS = {
    "digest": "Notification digests",
    "announcements": "Product announcements",
    "lost_alerts": "Lost-pet alerts near you",
}


async def _apply_unsubscribe(token: str, db: AsyncSession) -> UnsubscribeOut:
    payload = decode_unsubscribe_token(token)
    if not payload or payload.get("list") not in _UNSUB_LISTS:
        return UnsubscribeOut(status="invalid")
    list_name = payload["list"]

    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError):
        return UnsubscribeOut(status="invalid")

    prefs = (await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
    )).scalar_one_or_none()
    if prefs is None:
        # Never opened settings, so the row does not exist yet — create it
        # already opted out rather than silently doing nothing.
        prefs = NotificationPreference(user_id=user_id)
        db.add(prefs)

    if list_name == "digest":
        prefs.digest_mode = "off"
    elif list_name == "announcements":
        prefs.announcement_emails = False
    elif list_name == "lost_alerts":
        prefs.lost_dog_alerts = False

    await db.commit()
    logger.info("unsubscribed", user_id=str(user_id), list_name=list_name)
    return UnsubscribeOut(status="ok", list_name=list_name, label=_UNSUB_LISTS[list_name])


@router.post("/unsubscribe/{token}", response_model=UnsubscribeOut)
@limiter.limit("60/hour")
async def unsubscribe(
    token: str, request: Request, db: AsyncSession = Depends(get_db)
):
    """One-click opt-out (RFC 8058).

    Unauthenticated by design: the mail client POSTs this on the recipient's
    behalf, with no session and no CSRF token. The signed token is the
    credential, and it can only ever turn a preference *off* for the one user
    it names — worst case for a leaked token is someone gets fewer emails.
    """
    return await _apply_unsubscribe(token, db)


@router.get("/unsubscribe/{token}", response_model=UnsubscribeOut)
@limiter.limit("60/hour")
async def unsubscribe_via_link(
    token: str, request: Request, db: AsyncSession = Depends(get_db)
):
    """The footer link. Same effect as the one-click POST, so someone who
    clicks through in a browser is opted out without a second confirmation."""
    return await _apply_unsubscribe(token, db)


@router.get("/top-pet", response_model=PublicTopPetOut | None)
async def public_top_pet(
    species: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """The current Top Dog / Top Cat, if the crowned pet's share page is public."""
    q = select(WeeklyWinner).order_by(WeeklyWinner.week_bucket.desc())
    if species in ("dog", "cat"):
        q = q.where(WeeklyWinner.species == species)
    winner_result = await db.execute(q.limit(1))
    winner = winner_result.scalar_one_or_none()
    if not winner or winner.pet_id is None:
        return None

    pet_result = await db.execute(
        select(Pet)
        .options(selectinload(Pet.photos))
        .where(
            Pet.id == winner.pet_id,
            Pet.is_active == True,  # noqa: E712
            Pet.is_public == True,  # noqa: E712
        )
    )
    pet = pet_result.scalar_one_or_none()
    if not pet:
        return None

    return PublicTopPetOut(
        pet_id=pet.id,
        pet_name=pet.name,
        species=winner.species,
        week_bucket=winner.week_bucket,
        score=winner.score,
        photo_url=display_photo_url(pet),
    )


class PublicInviteOut(BaseModel):
    """What the signup form needs to prefill itself from an emailed invite.

    ``email`` comes back only for a still-valid code, so a consumed or guessed
    code discloses nothing.
    """

    status: Literal["valid", "used", "unknown"]
    email: str | None = None


@router.get("/invite/{code}", response_model=PublicInviteOut)
@limiter.limit("30/hour")
async def lookup_invite(
    request: Request,
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Resolve an emailed invite code to the address it was sent to.

    This exists so the invite link can stay ``/signup?invite=<code>``: putting
    the recipient's email in the query string would leak it into web-server
    access logs, outbound Referer headers, and browser history.
    """
    # Normalized the same way /auth/signup normalizes it, so a hand-typed
    # lowercase code doesn't report "unknown" here and then sign up fine.
    normalized = code.strip().upper()

    invite = (
        await db.execute(select(InviteCode).where(InviteCode.code == normalized))
    ).scalar_one_or_none()
    if invite is None:
        return PublicInviteOut(status="unknown")
    if invite.is_used:
        return PublicInviteOut(status="used")

    # A transfer invite carries its address on the code itself; waitlist
    # invites carry it on the entry. Admin/member codes have neither and
    # simply prefill nothing.
    if invite.invited_email:
        return PublicInviteOut(status="valid", email=invite.invited_email)

    # Only waitlist invites carry an address; admin-minted codes have none, and
    # those simply prefill nothing.
    email = (
        await db.execute(
            select(WaitlistEntry.email)
            .where(WaitlistEntry.invite_code == normalized)
            .limit(1)
        )
    ).scalar_one_or_none()
    return PublicInviteOut(status="valid", email=email)
