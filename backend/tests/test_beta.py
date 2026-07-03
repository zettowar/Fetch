import uuid

import pytest
from httpx import AsyncClient

from app.config import settings


def _signup_payload(invite_code: str | None = None) -> dict:
    payload = {
        "email": f"invited-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123",
        "display_name": "Invited User",
    }
    if invite_code is not None:
        payload["invite_code"] = invite_code
    return payload


@pytest.mark.asyncio
async def test_submit_feedback(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/feedback", json={
        "body": "Love this app!",
        "screen_name": "/home",
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["body"] == "Love this app!"


@pytest.mark.asyncio
async def test_admin_list_feedback(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    # Submit feedback first
    await client.post("/api/v1/feedback", json={
        "body": "Admin visible feedback"
    }, headers=auth_headers)

    res = await client.get("/api/v1/feedback", headers=admin_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_generate_invite_codes(client: AsyncClient, admin_headers: dict):
    res = await client.post("/api/v1/invites/generate", json={
        "count": 5,
    }, headers=admin_headers)
    assert res.status_code == 201
    assert len(res.json()) == 5
    assert all(c["code"].startswith("FETCH-") for c in res.json())


@pytest.mark.asyncio
async def test_list_invite_codes(client: AsyncClient, admin_headers: dict):
    await client.post("/api/v1/invites/generate", json={"count": 3}, headers=admin_headers)
    res = await client.get("/api/v1/invites", headers=admin_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 3


@pytest.mark.asyncio
async def test_feedback_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/feedback", json={"body": "test"})
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_invites_require_admin(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/invites/generate", json={"count": 1}, headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_generate_invite_codes_max_batch(client: AsyncClient, admin_headers: dict):
    """Schema upper bound is 100; honored by the endpoint."""
    res = await client.post("/api/v1/invites/generate", json={
        "count": 100,
    }, headers=admin_headers)
    assert res.status_code == 201
    assert len(res.json()) == 100


@pytest.mark.asyncio
async def test_generate_invite_codes_rejects_oversized_batch(
    client: AsyncClient, admin_headers: dict
):
    res = await client.post("/api/v1/invites/generate", json={
        "count": 250,
    }, headers=admin_headers)
    assert res.status_code == 422


# --- Invite-gated signup (INVITE_REQUIRED) ---

@pytest.mark.asyncio
async def test_gated_signup_requires_code(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "INVITE_REQUIRED", True)
    res = await client.post("/api/v1/auth/signup", json=_signup_payload())
    assert res.status_code == 400
    assert "invite" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_gated_signup_rejects_unknown_code(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "INVITE_REQUIRED", True)
    res = await client.post(
        "/api/v1/auth/signup", json=_signup_payload("FETCH-DOESNOTEXIST")
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_gated_signup_consumes_code(
    client: AsyncClient, admin_headers: dict, monkeypatch
):
    gen = await client.post(
        "/api/v1/invites/generate", json={"count": 1}, headers=admin_headers
    )
    code = gen.json()[0]["code"]

    monkeypatch.setattr(settings, "INVITE_REQUIRED", True)
    first = await client.post("/api/v1/auth/signup", json=_signup_payload(code))
    assert first.status_code == 201, first.text

    # The code is single-use.
    second = await client.post("/api/v1/auth/signup", json=_signup_payload(code))
    assert second.status_code == 400

    # Consumption is recorded for the admin view.
    listing = await client.get("/api/v1/invites", headers=admin_headers)
    used = next(c for c in listing.json() if c["code"] == code)
    assert used["is_used"] is True


@pytest.mark.asyncio
async def test_ungated_signup_ignores_code(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "INVITE_REQUIRED", False)
    res = await client.post("/api/v1/auth/signup", json=_signup_payload())
    assert res.status_code == 201
