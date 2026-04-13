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
