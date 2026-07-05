"""Stripe webhook: signature verification, idempotency, status transitions."""
import hashlib
import hmac
import json
import time
import uuid

import httpx
import pytest
from httpx import AsyncClient

from app.config import settings

from tests.test_donations import _FakeStripe, stripe_on  # noqa: F401 (fixture)

WEBHOOK = "/api/v1/donations/webhook"
SECRET = "whsec_test"


def _signed(event: dict, *, secret: str = SECRET, ts: int | None = None):
    payload = json.dumps(event).encode()
    ts = ts if ts is not None else int(time.time())
    mac = hmac.new(secret.encode(), f"{ts}.".encode() + payload, hashlib.sha256)
    return payload, {"stripe-signature": f"t={ts},v1={mac.hexdigest()}"}


def _event(type_: str, obj: dict, *, event_id: str | None = None) -> dict:
    return {
        "id": event_id or f"evt_{uuid.uuid4().hex[:16]}",
        "type": type_,
        "data": {"object": obj},
    }


async def _checkout(client: AsyncClient, auth_headers: dict, fake) -> str:
    """Create a pending platform donation; returns its checkout session id."""
    session_id = f"cs_test_{uuid.uuid4().hex[:10]}"
    fake.responses = {
        "/checkout/sessions": {"id": session_id, "url": "https://checkout.stripe.com/x"},
    }
    res = await client.post(
        "/api/v1/donations/checkout",
        json={"amount_cents": 1500, "recipient_type": "platform"},
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    return session_id


async def _status_of(client: AsyncClient, auth_headers: dict, session_id: str) -> str:
    # Query history rather than by-session so no lazy reconcile kicks in.
    rows = (await client.get("/api/v1/donations/me", headers=auth_headers)).json()
    for row in rows:
        found = await client.get(
            f"/api/v1/donations/by-session/{session_id}", headers=auth_headers
        )
        if found.status_code == 200 and found.json()["id"] == row["id"]:
            return row["status"]
    raise AssertionError("donation not found")


@pytest.mark.asyncio
async def test_webhook_503_when_disabled(client: AsyncClient):
    res = await client.post(WEBHOOK, content=b"{}")
    assert res.status_code == 503


@pytest.mark.asyncio
async def test_webhook_rejects_bad_signature(client: AsyncClient, auth_headers, stripe_on):
    payload, _ = _signed(_event("checkout.session.completed", {}))
    res = await client.post(
        WEBHOOK, content=payload,
        headers={"stripe-signature": f"t={int(time.time())},v1=deadbeef"},
    )
    assert res.status_code == 400

    # Wrong secret
    payload, headers = _signed(_event("x", {}), secret="whsec_other")
    assert (await client.post(WEBHOOK, content=payload, headers=headers)).status_code == 400


@pytest.mark.asyncio
async def test_webhook_rejects_stale_timestamp(client: AsyncClient, auth_headers, stripe_on):
    payload, headers = _signed(_event("x", {}), ts=int(time.time()) - 3600)
    res = await client.post(WEBHOOK, content=payload, headers=headers)
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_completed_marks_succeeded_and_notifies_once(
    client: AsyncClient, auth_headers: dict, stripe_on
):
    session_id = await _checkout(client, auth_headers, stripe_on)
    event = _event(
        "checkout.session.completed",
        {"id": session_id, "payment_intent": "pi_test_42"},
    )
    payload, headers = _signed(event)
    res = await client.post(WEBHOOK, content=payload, headers=headers)
    assert res.status_code == 200
    assert res.json() == {"received": True}

    rows = (await client.get("/api/v1/donations/me", headers=auth_headers)).json()
    row = next(r for r in rows if r["amount_cents"] == 1500)
    assert row["status"] == "succeeded"

    inbox = (await client.get(
        "/api/v1/notifications/inbox", headers=auth_headers
    )).json()
    thanks = [n for n in inbox if n["type"] == "donation_thanks"]
    assert len(thanks) == 1

    # Replay: same event id -> ack, no second notification.
    res = await client.post(WEBHOOK, content=payload, headers=headers)
    assert res.status_code == 200
    inbox = (await client.get(
        "/api/v1/notifications/inbox", headers=auth_headers
    )).json()
    assert len([n for n in inbox if n["type"] == "donation_thanks"]) == 1

    # Fresh event id for an already-succeeded donation: state guard no-ops.
    payload2, headers2 = _signed(_event(
        "checkout.session.completed",
        {"id": session_id, "payment_intent": "pi_test_42"},
    ))
    assert (await client.post(WEBHOOK, content=payload2, headers=headers2)).status_code == 200
    inbox = (await client.get(
        "/api/v1/notifications/inbox", headers=auth_headers
    )).json()
    assert len([n for n in inbox if n["type"] == "donation_thanks"]) == 1


@pytest.mark.asyncio
async def test_expired_marks_failed(client: AsyncClient, auth_headers: dict, stripe_on):
    session_id = await _checkout(client, auth_headers, stripe_on)
    payload, headers = _signed(_event("checkout.session.expired", {"id": session_id}))
    assert (await client.post(WEBHOOK, content=payload, headers=headers)).status_code == 200
    rows = (await client.get("/api/v1/donations/me", headers=auth_headers)).json()
    assert rows[0]["status"] == "failed"


@pytest.mark.asyncio
async def test_refund_transitions_succeeded_donation(
    client: AsyncClient, auth_headers: dict, stripe_on
):
    session_id = await _checkout(client, auth_headers, stripe_on)
    pi = f"pi_{uuid.uuid4().hex[:10]}"
    payload, headers = _signed(_event(
        "checkout.session.completed", {"id": session_id, "payment_intent": pi}
    ))
    assert (await client.post(WEBHOOK, content=payload, headers=headers)).status_code == 200

    payload, headers = _signed(_event("charge.refunded", {"payment_intent": pi}))
    assert (await client.post(WEBHOOK, content=payload, headers=headers)).status_code == 200
    rows = (await client.get("/api/v1/donations/me", headers=auth_headers)).json()
    assert rows[0]["status"] == "refunded"


@pytest.mark.asyncio
async def test_unknown_event_type_is_acked(client: AsyncClient, auth_headers, stripe_on):
    payload, headers = _signed(_event("customer.created", {"id": "cus_1"}))
    res = await client.post(WEBHOOK, content=payload, headers=headers)
    assert res.status_code == 200
    assert res.json() == {"received": True}


@pytest.mark.asyncio
async def test_connect_secret_also_verifies(client: AsyncClient, auth_headers, stripe_on, monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_connect")
    payload, headers = _signed(
        _event("account.updated", {"id": "acct_none", "charges_enabled": True}),
        secret="whsec_connect",
    )
    res = await client.post(WEBHOOK, content=payload, headers=headers)
    assert res.status_code == 200
