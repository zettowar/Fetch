import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_premium_status(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/billing/status", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["is_premium"] is False


@pytest.mark.asyncio
async def test_my_entitlements_empty(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/billing/entitlements", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_admin_grant_entitlement(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    # Get regular user's ID
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me.json()["id"]

    res = await client.post("/api/v1/billing/grant", json={
        "user_id": user_id,
        "entitlement_key": "ads_removed",
        "source": "beta_tester",
    }, headers=admin_headers)
    assert res.status_code == 201
    assert res.json()["entitlement_key"] == "ads_removed"

    # Verify premium status
    status_res = await client.get("/api/v1/billing/status", headers=auth_headers)
    assert status_res.json()["is_premium"] is True


@pytest.mark.asyncio
async def test_admin_revoke_entitlement(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me.json()["id"]

    # Grant first so revoke has something to remove.
    await client.post("/api/v1/billing/grant", json={
        "user_id": user_id,
        "entitlement_key": "ads_removed",
        "source": "manual_grant",
    }, headers=admin_headers)
    assert (await client.get("/api/v1/billing/status", headers=auth_headers)).json()["is_premium"] is True

    res = await client.delete(f"/api/v1/billing/grant/{user_id}/ads_removed", headers=admin_headers)
    assert res.status_code == 204

    # No longer premium after revoke.
    status_res = await client.get("/api/v1/billing/status", headers=auth_headers)
    assert status_res.json()["is_premium"] is False

    # Revoking again returns 404.
    res2 = await client.delete(f"/api/v1/billing/grant/{user_id}/ads_removed", headers=admin_headers)
    assert res2.status_code == 404


@pytest.mark.asyncio
async def test_revoke_requires_admin(client: AsyncClient, auth_headers: dict):
    fake_user = uuid.uuid4()
    res = await client.delete(f"/api/v1/billing/grant/{fake_user}/ads_removed", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_grant_is_idempotent(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    """Granting the same entitlement twice must not create duplicate rows;
    premium_status would raise on multiple-results otherwise."""
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me.json()["id"]

    payload = {"user_id": user_id, "entitlement_key": "ads_removed", "source": "admin_grant"}
    r1 = await client.post("/api/v1/billing/grant", json=payload, headers=admin_headers)
    r2 = await client.post("/api/v1/billing/grant", json=payload, headers=admin_headers)
    assert r1.status_code in (200, 201)
    assert r2.status_code in (200, 201)
    # Same row returned both times.
    assert r1.json()["id"] == r2.json()["id"]

    # premium_status must still succeed (would 500 if there were dupes
    # because of scalar_one_or_none).
    status_res = await client.get("/api/v1/billing/status", headers=auth_headers)
    assert status_res.status_code == 200
    assert status_res.json()["is_premium"] is True


@pytest.mark.asyncio
async def test_notification_preferences(client: AsyncClient, auth_headers: dict):
    # Get defaults
    res = await client.get("/api/v1/notifications/preferences", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["lost_dog_alerts"] is True

    # Update
    res2 = await client.patch("/api/v1/notifications/preferences", json={
        "lost_dog_alerts": False,
        "digest_mode": "daily",
    }, headers=auth_headers)
    assert res2.status_code == 200
    assert res2.json()["lost_dog_alerts"] is False
    assert res2.json()["digest_mode"] == "daily"
