"""Stripe integration for donations, via the plain REST API.

No SDK: the surface is five form-encoded REST calls plus a documented HMAC
webhook check, so we call https://api.stripe.com directly with httpx — same
house style as the Resend email service, and natively async.

Unlike email, this is a user-facing money flow, so failures RAISE
(StripeError) instead of returning False; routers map that to a 502. Disabled
mode (empty STRIPE_SECRET_KEY) is checked by callers via stripe_enabled().
"""
import hashlib
import hmac
import json
import time
import uuid

import httpx
import structlog

from app.config import settings

logger = structlog.stdlib.get_logger()

STRIPE_API = "https://api.stripe.com/v1"
WEBHOOK_TOLERANCE_S = 300


class StripeError(Exception):
    """Stripe call failed (network, auth, or 4xx/5xx) or webhook is invalid."""


def stripe_enabled() -> bool:
    return bool(settings.STRIPE_SECRET_KEY)


def _flatten(params: dict, prefix: str = "") -> dict[str, str]:
    """Encode nested dicts/lists the way Stripe's form API expects.

    {"line_items": [{"quantity": 1}]} -> {"line_items[0][quantity]": "1"}
    """
    flat: dict[str, str] = {}
    for key, value in params.items():
        full = f"{prefix}[{key}]" if prefix else str(key)
        if isinstance(value, dict):
            flat.update(_flatten(value, full))
        elif isinstance(value, (list, tuple)):
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    flat.update(_flatten(item, f"{full}[{i}]"))
                else:
                    flat[f"{full}[{i}]"] = str(item)
        elif isinstance(value, bool):
            flat[full] = "true" if value else "false"
        elif value is not None:
            flat[full] = str(value)
    return flat


async def _request(method: str, path: str, params: dict | None = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=settings.STRIPE_TIMEOUT_S) as client:
            resp = await client.request(
                method,
                f"{STRIPE_API}{path}",
                headers={"Authorization": f"Bearer {settings.STRIPE_SECRET_KEY}"},
                data=_flatten(params) if params else None,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("stripe_request_failed", path=path, error=str(exc))
        raise StripeError(f"Stripe request failed: {exc}") from exc

    if resp.status_code >= 400:
        # Stripe error bodies are JSON with error.message; log a trimmed copy.
        logger.warning(
            "stripe_request_rejected",
            path=path, status=resp.status_code, body=resp.text[:500],
        )
        raise StripeError(f"Stripe returned {resp.status_code}")

    return resp.json()


async def _post(path: str, params: dict) -> dict:
    return await _request("POST", path, params)


async def _get(path: str) -> dict:
    return await _request("GET", path)


async def create_checkout_session(
    *,
    donation_id: uuid.UUID,
    amount_cents: int,
    product_name: str,
    donor_email: str,
    destination_account: str | None = None,
    application_fee_cents: int = 0,
) -> dict:
    """Create a hosted Checkout session; returns the Stripe session object.

    destination_account routes the payment to a rescue's Connect account
    (destination charge); application_fee_cents is the platform's cut.
    """
    params: dict = {
        "mode": "payment",
        "submit_type": "donate",
        "customer_email": donor_email,
        "line_items": [
            {
                "quantity": 1,
                "price_data": {
                    "currency": "usd",
                    "unit_amount": amount_cents,
                    "product_data": {"name": product_name},
                },
            }
        ],
        # {CHECKOUT_SESSION_ID} is a literal Stripe template token.
        "success_url": (
            f"{settings.FRONTEND_BASE_URL}/app/donate/success"
            "?session_id={CHECKOUT_SESSION_ID}"
        ),
        "cancel_url": f"{settings.FRONTEND_BASE_URL}/app/donate?cancelled=1",
        "metadata": {"donation_id": str(donation_id)},
    }
    if destination_account:
        params["payment_intent_data"] = {
            "transfer_data": {"destination": destination_account}
        }
        if application_fee_cents:
            params["payment_intent_data"]["application_fee_amount"] = (
                application_fee_cents
            )
    return await _post("/checkout/sessions", params)


async def retrieve_checkout_session(session_id: str) -> dict:
    return await _get(f"/checkout/sessions/{session_id}")


async def create_refund(payment_intent_id: str) -> dict:
    """Fully refund a captured payment by its PaymentIntent. For destination
    (rescue) charges this also reverses the transfer so the platform isn't out
    of pocket. The `charge.refunded` webhook flips the donation to 'refunded'."""
    return await _post("/refunds", {
        "payment_intent": payment_intent_id,
        "reverse_transfer": "true",
        "refund_application_fee": "true",
    })


def verify_webhook(payload: bytes, sig_header: str) -> dict:
    """Verify a Stripe-Signature header and return the parsed event.

    Tries every configured signing secret (the platform endpoint and the
    optional Connect endpoint have different secrets). Raises StripeError on
    any mismatch, malformed header, or stale timestamp.
    """
    secrets = [
        s
        for s in (
            settings.STRIPE_WEBHOOK_SECRET,
            settings.STRIPE_CONNECT_WEBHOOK_SECRET,
        )
        if s
    ]
    if not secrets:
        raise StripeError("No webhook secret configured")

    timestamp = ""
    candidates: list[str] = []
    for part in sig_header.split(","):
        key, _, value = part.strip().partition("=")
        if key == "t":
            timestamp = value
        elif key == "v1":
            candidates.append(value)
    if not timestamp or not candidates:
        raise StripeError("Malformed Stripe-Signature header")

    try:
        ts = int(timestamp)
    except ValueError as exc:
        raise StripeError("Malformed Stripe-Signature timestamp") from exc
    if abs(time.time() - ts) > WEBHOOK_TOLERANCE_S:
        raise StripeError("Stripe-Signature timestamp outside tolerance")

    signed_payload = f"{timestamp}.".encode() + payload
    for secret in secrets:
        expected = hmac.new(
            secret.encode(), signed_payload, hashlib.sha256
        ).hexdigest()
        if any(hmac.compare_digest(expected, c) for c in candidates):
            return json.loads(payload)
    raise StripeError("Stripe-Signature verification failed")


# --- Connect (Express) — rescues accepting in-app donations ---


async def create_express_account(*, email: str, org_name: str) -> dict:
    return await _post(
        "/accounts",
        {
            "type": "express",
            "country": "US",
            "email": email,
            "business_profile": {"name": org_name},
            "capabilities": {"transfers": {"requested": True}},
        },
    )


async def create_account_link(account_id: str) -> dict:
    """Mint a fresh onboarding link (they expire in minutes — never cache)."""
    dashboard = f"{settings.FRONTEND_BASE_URL}/app/rescue/dashboard"
    return await _post(
        "/account_links",
        {
            "account": account_id,
            "type": "account_onboarding",
            "refresh_url": f"{dashboard}?connect=refresh",
            "return_url": f"{dashboard}?connect=return",
        },
    )


async def retrieve_account(account_id: str) -> dict:
    return await _get(f"/accounts/{account_id}")
