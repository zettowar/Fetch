"""Donation endpoints: config, checkout, history, Connect onboarding.

Stripe is disabled by default in the test env (empty STRIPE_SECRET_KEY);
enabled-path tests monkeypatch the key and replace httpx.AsyncClient with a
programmable fake (same approach as test_email.py / test_moderation_fallbacks).
"""
import uuid

import httpx
import pytest
from httpx import AsyncClient

from app.config import settings
from app.services import stripe_service
from app.services.stripe_service import _flatten


# --- fake Stripe HTTP client ---


class _Resp:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload
        self.text = str(payload)

    def json(self) -> dict:
        return self._payload


class _FakeStripe:
    """Programmable httpx.AsyncClient stand-in. Routes by path suffix."""

    responses: dict[str, dict] = {}
    fail_with: int | None = None
    calls: list[tuple[str, str, dict | None]] = []

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def request(self, method, url, headers=None, data=None):
        _FakeStripe.calls.append((method, url, data))
        if _FakeStripe.fail_with is not None:
            return _Resp(_FakeStripe.fail_with, {"error": {"message": "nope"}})
        for suffix, payload in _FakeStripe.responses.items():
            if suffix in url:
                return _Resp(200, payload)
        return _Resp(404, {"error": {"message": f"no fake for {url}"}})


@pytest.fixture
def stripe_on(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_SECRET_KEY", "sk_test_fake")
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test")
    monkeypatch.setattr(httpx, "AsyncClient", _FakeStripe)
    _FakeStripe.responses = {}
    _FakeStripe.fail_with = None
    _FakeStripe.calls = []
    return _FakeStripe


async def _make_approved_rescue(client: AsyncClient, admin_headers: dict):
    email = f"rescue-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup-rescue", json={
        "email": email, "password": "password123",
        "org_name": "Donation Rescue", "description": "test rescue",
        "donation_url": "https://example.org/donate",
    })
    assert signup.status_code == 201, signup.text
    headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}
    profile_id = signup.json()["rescue_profile"]["id"]
    approve = await client.post(
        f"/api/v1/admin/rescue-profiles/{profile_id}/review",
        json={"approve": True}, headers=admin_headers,
    )
    assert approve.status_code == 200, approve.text
    return profile_id, headers


# --- _flatten unit tests ---


def test_flatten_nested_params():
    flat = _flatten({
        "mode": "payment",
        "line_items": [{"quantity": 1, "price_data": {"unit_amount": 500}}],
        "metadata": {"donation_id": "abc"},
        "flag": True,
    })
    assert flat == {
        "mode": "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][unit_amount]": "500",
        "metadata[donation_id]": "abc",
        "flag": "true",
    }


def test_flatten_drops_none_values():
    assert _flatten({"a": None, "b": 1}) == {"b": "1"}


# --- disabled mode ---


@pytest.mark.asyncio
async def test_config_reports_disabled(client: AsyncClient, auth_headers: dict):
    assert settings.STRIPE_SECRET_KEY == ""
    res = await client.get("/api/v1/donations/config", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is False
    assert body["presets_cents"] == [500, 1000, 2500, 5000]


@pytest.mark.asyncio
async def test_checkout_503_when_disabled(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/api/v1/donations/checkout",
        json={"amount_cents": 500, "recipient_type": "platform"},
        headers=auth_headers,
    )
    assert res.status_code == 503


# --- platform checkout ---


@pytest.mark.asyncio
async def test_platform_checkout_creates_pending_donation(
    client: AsyncClient, auth_headers: dict, stripe_on
):
    stripe_on.responses = {
        "/checkout/sessions": {
            "id": f"cs_test_{uuid.uuid4().hex[:10]}",
            "url": "https://checkout.stripe.com/c/pay/cs_test",
        }
    }
    res = await client.post(
        "/api/v1/donations/checkout",
        json={"amount_cents": 1000, "recipient_type": "platform", "message": "Woof!"},
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    assert res.json()["checkout_url"].startswith("https://checkout.stripe.com/")

    # Sent the right params to Stripe.
    method, url, data = stripe_on.calls[-1]
    assert method == "POST" and url.endswith("/checkout/sessions")
    assert data["line_items[0][price_data][unit_amount]"] == "1000"
    assert data["submit_type"] == "donate"
    assert "{CHECKOUT_SESSION_ID}" in data["success_url"]
    assert "payment_intent_data[transfer_data][destination]" not in data

    # Row visible in history as pending.
    history = await client.get("/api/v1/donations/me", headers=auth_headers)
    assert history.status_code == 200
    row = history.json()[0]
    assert row["status"] == "pending"
    assert row["recipient_name"] == "Fetch"
    assert row["amount_cents"] == 1000
    assert row["message"] == "Woof!"


@pytest.mark.asyncio
async def test_checkout_amount_bounds(client: AsyncClient, auth_headers: dict, stripe_on):
    for cents in (50, 10_000_001):
        res = await client.post(
            "/api/v1/donations/checkout",
            json={"amount_cents": cents, "recipient_type": "platform"},
            headers=auth_headers,
        )
        assert res.status_code == 422, cents


@pytest.mark.asyncio
async def test_checkout_stripe_error_persists_nothing(
    client: AsyncClient, auth_headers: dict, stripe_on
):
    stripe_on.fail_with = 500
    before = await client.get("/api/v1/donations/me", headers=auth_headers)
    res = await client.post(
        "/api/v1/donations/checkout",
        json={"amount_cents": 500, "recipient_type": "platform"},
        headers=auth_headers,
    )
    assert res.status_code == 502
    after = await client.get("/api/v1/donations/me", headers=auth_headers)
    assert len(after.json()) == len(before.json())


@pytest.mark.asyncio
async def test_rescue_checkout_requires_rescue_id(
    client: AsyncClient, auth_headers: dict, stripe_on
):
    res = await client.post(
        "/api/v1/donations/checkout",
        json={"amount_cents": 500, "recipient_type": "rescue"},
        headers=auth_headers,
    )
    assert res.status_code == 422


# --- by-session lookup ---


@pytest.mark.asyncio
async def test_by_session_is_donor_only_and_reconciles(
    client: AsyncClient, auth_headers: dict, admin_headers: dict, stripe_on
):
    session_id = f"cs_test_{uuid.uuid4().hex[:10]}"
    stripe_on.responses = {
        "/checkout/sessions/": {  # retrieve (matched before create by suffix)
            "id": session_id,
            "payment_status": "paid",
            "payment_intent": "pi_test_1",
        },
        "/checkout/sessions": {"id": session_id, "url": "https://checkout.stripe.com/x"},
    }
    created = await client.post(
        "/api/v1/donations/checkout",
        json={"amount_cents": 2500, "recipient_type": "platform"},
        headers=auth_headers,
    )
    assert created.status_code == 201

    # Another account can't see it.
    other = await client.get(
        f"/api/v1/donations/by-session/{session_id}", headers=admin_headers
    )
    assert other.status_code == 404

    # Donor sees it; lazy reconcile promotes pending -> succeeded.
    mine = await client.get(
        f"/api/v1/donations/by-session/{session_id}", headers=auth_headers
    )
    assert mine.status_code == 200, mine.text
    assert mine.json()["status"] == "succeeded"


# --- Connect onboarding ---


@pytest.mark.asyncio
async def test_connect_onboard_rejects_non_rescue(
    client: AsyncClient, auth_headers: dict, stripe_on
):
    res = await client.post("/api/v1/donations/connect/onboard", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_connect_onboard_creates_account_once(
    client: AsyncClient, admin_headers: dict, stripe_on
):
    _, rescue_headers = await _make_approved_rescue(client, admin_headers)
    account_id = f"acct_{uuid.uuid4().hex[:12]}"
    stripe_on.responses = {
        "/account_links": {"url": "https://connect.stripe.com/setup/x"},
        "/accounts": {"id": account_id},
    }

    first = await client.post(
        "/api/v1/donations/connect/onboard", headers=rescue_headers
    )
    assert first.status_code == 200, first.text
    assert first.json()["url"].startswith("https://connect.stripe.com/")
    account_creates = [c for c in stripe_on.calls if c[1].endswith("/accounts")]
    assert len(account_creates) == 1

    # Second call reuses the account: only a fresh link is minted.
    second = await client.post(
        "/api/v1/donations/connect/onboard", headers=rescue_headers
    )
    assert second.status_code == 200
    account_creates = [c for c in stripe_on.calls if c[1].endswith("/accounts")]
    assert len(account_creates) == 1

    status = await client.get(
        "/api/v1/donations/connect/status", headers=rescue_headers
    )
    assert status.status_code == 200
    assert status.json()["has_account"] is True


@pytest.mark.asyncio
async def test_connect_status_syncs_charges_enabled(
    client: AsyncClient, admin_headers: dict, stripe_on
):
    _, rescue_headers = await _make_approved_rescue(client, admin_headers)
    account_id = f"acct_{uuid.uuid4().hex[:12]}"
    stripe_on.responses = {
        "/account_links": {"url": "https://connect.stripe.com/setup/x"},
        "/accounts/": {  # retrieve
            "id": account_id, "charges_enabled": True, "details_submitted": True,
        },
        "/accounts": {"id": account_id},  # create
    }
    onboard = await client.post(
        "/api/v1/donations/connect/onboard", headers=rescue_headers
    )
    assert onboard.status_code == 200

    status = await client.get(
        "/api/v1/donations/connect/status", headers=rescue_headers
    )
    assert status.status_code == 200, status.text
    body = status.json()
    assert body == {
        "has_account": True, "charges_enabled": True, "details_submitted": True,
    }


# --- rescue checkout (destination charges) ---


@pytest.mark.asyncio
async def test_rescue_checkout_409_when_not_connect_enabled(
    client: AsyncClient, auth_headers: dict, admin_headers: dict, stripe_on
):
    profile_id, _ = await _make_approved_rescue(client, admin_headers)
    res = await client.post(
        "/api/v1/donations/checkout",
        json={
            "amount_cents": 500,
            "recipient_type": "rescue",
            "rescue_id": profile_id,
        },
        headers=auth_headers,
    )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_rescue_checkout_destination_charge_with_fee(
    client: AsyncClient, auth_headers: dict, admin_headers: dict, stripe_on, monkeypatch
):
    monkeypatch.setattr(settings, "DONATION_PLATFORM_FEE_PERCENT", 5.0)
    profile_id, rescue_headers = await _make_approved_rescue(client, admin_headers)
    account_id = f"acct_{uuid.uuid4().hex[:12]}"
    stripe_on.responses = {
        "/account_links": {"url": "https://connect.stripe.com/setup/x"},
        "/accounts/": {"id": account_id, "charges_enabled": True, "details_submitted": True},
        "/accounts": {"id": account_id},
        "/checkout/sessions": {
            "id": f"cs_test_{uuid.uuid4().hex[:10]}",
            "url": "https://checkout.stripe.com/x",
        },
    }
    # Onboard + sync charges_enabled via status.
    assert (await client.post(
        "/api/v1/donations/connect/onboard", headers=rescue_headers
    )).status_code == 200
    assert (await client.get(
        "/api/v1/donations/connect/status", headers=rescue_headers
    )).json()["charges_enabled"] is True

    res = await client.post(
        "/api/v1/donations/checkout",
        json={
            "amount_cents": 2000,
            "recipient_type": "rescue",
            "rescue_id": profile_id,
        },
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    _, _, data = stripe_on.calls[-1]
    assert data["payment_intent_data[transfer_data][destination]"] == account_id
    assert data["payment_intent_data[application_fee_amount]"] == "100"  # 5% of 2000

    row = (await client.get("/api/v1/donations/me", headers=auth_headers)).json()[0]
    assert row["recipient_name"] == "Donation Rescue"
    assert row["recipient_type"] == "rescue"

    # Rescue is now flagged as donations-enabled on its public profile.
    public = await client.get(f"/api/v1/rescues/{profile_id}", headers=auth_headers)
    assert public.status_code == 200
    assert public.json()["donations_enabled"] is True


@pytest.mark.asyncio
async def test_rescue_checkout_fee_zero_omits_application_fee(
    client: AsyncClient, auth_headers: dict, admin_headers: dict, stripe_on
):
    assert settings.DONATION_PLATFORM_FEE_PERCENT == 0.0
    profile_id, rescue_headers = await _make_approved_rescue(client, admin_headers)
    account_id = f"acct_{uuid.uuid4().hex[:12]}"
    stripe_on.responses = {
        "/account_links": {"url": "https://connect.stripe.com/setup/x"},
        "/accounts/": {"id": account_id, "charges_enabled": True, "details_submitted": True},
        "/accounts": {"id": account_id},
        "/checkout/sessions": {
            "id": f"cs_test_{uuid.uuid4().hex[:10]}",
            "url": "https://checkout.stripe.com/x",
        },
    }
    assert (await client.post(
        "/api/v1/donations/connect/onboard", headers=rescue_headers
    )).status_code == 200
    assert (await client.get(
        "/api/v1/donations/connect/status", headers=rescue_headers
    )).json()["charges_enabled"] is True

    res = await client.post(
        "/api/v1/donations/checkout",
        json={
            "amount_cents": 2000,
            "recipient_type": "rescue",
            "rescue_id": profile_id,
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    _, _, data = stripe_on.calls[-1]
    assert data["payment_intent_data[transfer_data][destination]"] == account_id
    assert "payment_intent_data[application_fee_amount]" not in data


# --- admin oversight ---


@pytest.mark.asyncio
async def test_admin_donations_list_and_totals(
    client: AsyncClient, auth_headers: dict, admin_headers: dict, stripe_on
):
    res = await client.get("/api/v1/admin/donations", headers=admin_headers)
    assert res.status_code == 200
    body = res.json()
    assert {"items", "succeeded_count", "succeeded_amount_cents", "succeeded_fee_cents"} <= set(body)

    # Non-admins are rejected.
    assert (await client.get(
        "/api/v1/admin/donations", headers=auth_headers
    )).status_code == 403
