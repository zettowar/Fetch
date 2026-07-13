"""In-app donations via Stripe Checkout.

Platform donations settle to the platform account; rescue donations are
Connect destination charges straight to the rescue's Express account (with an
optional platform application fee). Empty STRIPE_SECRET_KEY = the whole
feature is disabled: endpoints 503 and the UI falls back to rescues' external
donation links.
"""
import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_approved_rescue
from app.limiter import limiter
from app.models.donation import Donation, StripeEvent
from app.models.rescue import RescueProfile
from app.models.user import User
from app.schemas.donation import (
    ConnectStatusOut,
    DonationCheckoutRequest,
    DonationCheckoutResponse,
    DonationConfig,
    DonationOut,
)
from app.services import stripe_service
from app.services.notify import notify
from app.services.stripe_service import StripeError, stripe_enabled

logger = structlog.stdlib.get_logger()

router = APIRouter()

PLATFORM_RECIPIENT_NAME = "Fetch"


def _require_enabled() -> None:
    if not stripe_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Donations are not enabled",
        )


def _presets() -> list[int]:
    out: list[int] = []
    for part in settings.DONATION_PRESETS.split(","):
        part = part.strip()
        if part.isdigit():
            out.append(int(part))
    return out


@router.get("/config", response_model=DonationConfig)
async def donation_config(user: User = Depends(get_current_user)):
    return DonationConfig(
        enabled=stripe_enabled(),
        presets_cents=_presets(),
        min_cents=settings.DONATION_MIN_CENTS,
        max_cents=settings.DONATION_MAX_CENTS,
        platform_fee_percent=settings.DONATION_PLATFORM_FEE_PERCENT,
    )


@router.post(
    "/checkout",
    response_model=DonationCheckoutResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/hour")
async def create_checkout(
    body: DonationCheckoutRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()

    from app.services import settings_service
    if await settings_service.get_setting(db, "donations_paused"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Donations are temporarily paused",
        )

    recipient_name = PLATFORM_RECIPIENT_NAME
    destination_account: str | None = None
    application_fee_cents = 0

    if body.recipient_type == "rescue":
        result = await db.execute(
            select(RescueProfile).where(RescueProfile.id == body.rescue_id)
        )
        rescue = result.scalar_one_or_none()
        # Match public visibility: unapproved rescues don't exist here.
        if not rescue or rescue.status != "approved":
            raise HTTPException(status_code=404, detail="Rescue not found")
        if not rescue.donations_enabled:
            # 409 lets the UI fall back to the rescue's external link.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This rescue accepts donations via their external link",
            )
        recipient_name = rescue.org_name
        destination_account = rescue.stripe_account_id
        application_fee_cents = int(
            body.amount_cents * settings.DONATION_PLATFORM_FEE_PERCENT / 100
        )

    donation_id = uuid.uuid4()
    product_name = (
        "Donation to Fetch"
        if body.recipient_type == "platform"
        else f"Donation to {recipient_name}"
    )
    try:
        session = await stripe_service.create_checkout_session(
            donation_id=donation_id,
            amount_cents=body.amount_cents,
            product_name=product_name,
            donor_email=user.email,
            destination_account=destination_account,
            application_fee_cents=application_fee_cents,
        )
    except StripeError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment provider error — please try again",
        )

    donation = Donation(
        id=donation_id,
        user_id=user.id,
        recipient_type=body.recipient_type,
        rescue_id=body.rescue_id,
        recipient_name=recipient_name,
        amount_cents=body.amount_cents,
        currency="usd",
        application_fee_cents=application_fee_cents,
        status="pending",
        stripe_checkout_session_id=session["id"],
        message=body.message,
    )
    db.add(donation)
    await db.commit()
    logger.info(
        "donation_checkout_created",
        donation_id=str(donation_id),
        recipient_type=body.recipient_type,
        amount_cents=body.amount_cents,
    )
    return DonationCheckoutResponse(
        donation_id=donation_id, checkout_url=session["url"]
    )


@router.get("/me", response_model=list[DonationOut])
async def my_donations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Donation)
        .where(Donation.user_id == user.id)
        .order_by(Donation.created_at.desc())
        .limit(100)
    )
    return list(result.scalars().all())


@router.get("/by-session/{session_id}", response_model=DonationOut)
async def donation_by_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Success-page lookup. Lazily reconciles with Stripe so the page works
    even when it loads before the webhook lands."""
    result = await db.execute(
        select(Donation).where(
            Donation.stripe_checkout_session_id == session_id
        )
    )
    donation = result.scalar_one_or_none()
    if not donation or donation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Donation not found")

    if donation.status == "pending" and stripe_enabled():
        try:
            session = await stripe_service.retrieve_checkout_session(session_id)
        except StripeError:
            return donation  # page shows "processing"; webhook will settle it
        if session.get("payment_status") == "paid":
            await _mark_succeeded(
                db, donation, payment_intent=session.get("payment_intent")
            )
            await db.commit()
    return donation


# --- Connect (Express) — rescue onboarding ---


@router.post("/connect/onboard")
@limiter.limit("10/hour")
async def connect_onboard(
    request: Request,
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    _require_enabled()
    result = await db.execute(
        select(RescueProfile).where(RescueProfile.user_id == user.id)
    )
    profile = result.scalar_one()

    try:
        if not profile.stripe_account_id:
            account = await stripe_service.create_express_account(
                email=user.email, org_name=profile.org_name
            )
            profile.stripe_account_id = account["id"]
            await db.commit()
        link = await stripe_service.create_account_link(profile.stripe_account_id)
    except StripeError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Payment provider error — please try again",
        )
    return {"url": link["url"]}


@router.get("/connect/status", response_model=ConnectStatusOut)
async def connect_status(
    user: User = Depends(require_approved_rescue),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RescueProfile).where(RescueProfile.user_id == user.id)
    )
    profile = result.scalar_one()
    if not profile.stripe_account_id:
        return ConnectStatusOut(has_account=False, charges_enabled=False)

    details_submitted: bool | None = None
    if stripe_enabled():
        # Sync-on-read keeps charges_enabled fresh even without the optional
        # Connect webhook endpoint.
        try:
            account = await stripe_service.retrieve_account(
                profile.stripe_account_id
            )
        except StripeError:
            account = None
        if account is not None:
            details_submitted = bool(account.get("details_submitted"))
            charges_enabled = bool(account.get("charges_enabled"))
            if charges_enabled != profile.stripe_charges_enabled:
                profile.stripe_charges_enabled = charges_enabled
                await db.commit()
    return ConnectStatusOut(
        has_account=True,
        charges_enabled=profile.stripe_charges_enabled,
        details_submitted=details_submitted,
    )


# --- Webhook ---


async def _mark_succeeded(
    db: AsyncSession, donation: Donation, *, payment_intent: str | None
) -> None:
    """Single place a donation becomes 'succeeded' (webhook + lazy reconcile).

    Adds notifications to the session without committing — the caller owns
    the transaction (house rule from services/notify.py).
    """
    donation.status = "succeeded"
    donation.stripe_payment_intent_id = payment_intent
    amount = f"${donation.amount_cents / 100:.2f}"
    if donation.user_id:
        await notify(
            db,
            donation.user_id,
            type="donation_thanks",
            title=f"Thanks for your {amount} donation!",
            body=f"Your donation to {donation.recipient_name} was received. 🐾",
            link="/app/donations",
        )
    if donation.recipient_type == "rescue" and donation.rescue_id:
        result = await db.execute(
            select(RescueProfile.user_id).where(
                RescueProfile.id == donation.rescue_id
            )
        )
        rescue_user_id = result.scalar_one_or_none()
        if rescue_user_id:
            await notify(
                db,
                rescue_user_id,
                type="donation_received",
                title=f"You received a {amount} donation!",
                body=donation.message,
                link="/app/rescue/dashboard",
            )


async def _donation_by_session_id(db: AsyncSession, session_id: str) -> Donation | None:
    result = await db.execute(
        select(Donation).where(Donation.stripe_checkout_session_id == session_id)
    )
    return result.scalar_one_or_none()


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Stripe event sink. Unauthenticated — the HMAC signature is the gate.

    Not rate-limited: Stripe retries with backoff and 429s would only delay
    donation confirmation.
    """
    if not stripe_enabled():
        raise HTTPException(status_code=503, detail="Donations are not enabled")

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe_service.verify_webhook(payload, sig)
    except StripeError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Idempotency gate: unique event_id; a replay hits IntegrityError and acks
    # without reprocessing.
    db.add(StripeEvent(event_id=event["id"], type=event["type"]))
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        return {"received": True}

    obj = event.get("data", {}).get("object", {})
    event_type = event["type"]

    if event_type == "checkout.session.completed":
        donation = await _donation_by_session_id(db, obj.get("id", ""))
        # status guard = second idempotency layer (lazy reconcile may have won)
        if donation and donation.status == "pending":
            await _mark_succeeded(
                db, donation, payment_intent=obj.get("payment_intent")
            )
    elif event_type == "checkout.session.expired":
        donation = await _donation_by_session_id(db, obj.get("id", ""))
        if donation and donation.status == "pending":
            donation.status = "failed"
    elif event_type == "charge.refunded":
        payment_intent = obj.get("payment_intent")
        if payment_intent:
            result = await db.execute(
                select(Donation).where(
                    Donation.stripe_payment_intent_id == payment_intent
                )
            )
            donation = result.scalar_one_or_none()
            if donation and donation.status == "succeeded":
                donation.status = "refunded"
    elif event_type == "account.updated":
        result = await db.execute(
            select(RescueProfile).where(
                RescueProfile.stripe_account_id == obj.get("id", "")
            )
        )
        profile = result.scalar_one_or_none()
        if profile:
            profile.stripe_charges_enabled = bool(obj.get("charges_enabled"))
    else:
        logger.info("stripe_event_ignored", type=event_type)

    await db.commit()  # event row + mutation land atomically
    return {"received": True}
