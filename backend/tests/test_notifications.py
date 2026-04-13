"""Tests for notification preferences and push subscriptions."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_preferences_returns_defaults(client: AsyncClient, auth_headers: dict):
    """Fetching prefs before any update returns default values."""
    res = await client.get("/api/v1/notifications/preferences", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    # All boolean preference fields should exist
    assert isinstance(data.get("lost_dog_alerts"), bool)
    assert isinstance(data.get("weekly_winner"), bool)


@pytest.mark.asyncio
async def test_update_preferences(client: AsyncClient, auth_headers: dict):
    res = await client.patch(
        "/api/v1/notifications/preferences",
        json={"lost_dog_alerts": False, "weekly_winner": False},
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["lost_dog_alerts"] is False
    assert data["weekly_winner"] is False


@pytest.mark.asyncio
async def test_update_preferences_partial(client: AsyncClient, auth_headers: dict):
    """Partial update only changes specified fields."""
    # Set baseline
    await client.patch(
        "/api/v1/notifications/preferences",
        json={"lost_dog_alerts": True, "weekly_winner": True},
        headers=auth_headers,
    )
    # Update only one field
    res = await client.patch(
        "/api/v1/notifications/preferences",
        json={"lost_dog_alerts": False},
        headers=auth_headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["lost_dog_alerts"] is False
    assert data["weekly_winner"] is True


@pytest.mark.asyncio
async def test_preferences_require_auth(client: AsyncClient):
    res = await client.get("/api/v1/notifications/preferences")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_push_subscribe(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/api/v1/notifications/push/subscribe",
        json={
            "endpoint": "https://push.example.com/sub/abc123",
            "p256dh": "test_p256dh_key",
            "auth": "test_auth_secret",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["endpoint"] == "https://push.example.com/sub/abc123"


@pytest.mark.asyncio
async def test_push_unsubscribe(client: AsyncClient, auth_headers: dict):
    # Subscribe first
    await client.post(
        "/api/v1/notifications/push/subscribe",
        json={
            "endpoint": "https://push.example.com/sub/xyz789",
            "p256dh": "key",
            "auth": "secret",
        },
        headers=auth_headers,
    )
    # Then unsubscribe
    res = await client.delete("/api/v1/notifications/push/unsubscribe", headers=auth_headers)
    assert res.status_code == 200
    assert "unsubscribed" in res.json()["detail"].lower()
