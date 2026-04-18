from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient


async def _make_park_and_dog(
    client: AsyncClient, user_headers: dict, admin_headers: dict,
) -> tuple[str, str]:
    """Parks now require admin to create, so we accept both header sets:
    create the park as admin, the dog as the regular user."""
    park = await client.post(
        "/api/v1/parks",
        json={"name": "Meetup Park", "lat": 37.77, "lng": -122.42},
        headers=admin_headers,
    )
    assert park.status_code == 201, park.text
    dog = await client.post(
        "/api/v1/dogs",
        json={"name": "Rex"},
        headers=user_headers,
    )
    assert dog.status_code == 201
    return park.json()["id"], dog.json()["id"]


def _future_iso(minutes: int = 60) -> str:
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


@pytest.mark.asyncio
async def test_create_playdate(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    park_id, dog_id = await _make_park_and_dog(client, auth_headers, admin_headers)
    res = await client.post(
        "/api/v1/playdates",
        json={
            "park_id": park_id,
            "host_dog_id": dog_id,
            "scheduled_for": _future_iso(60),
            "title": "Puppy social",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["title"] == "Puppy social"
    assert body["going_count"] == 1  # host auto-RSVPed
    assert len(body["rsvps"]) == 1
    assert body["rsvps"][0]["dog_id"] == dog_id


@pytest.mark.asyncio
async def test_playdate_past_date_rejected(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    park_id, dog_id = await _make_park_and_dog(client, auth_headers, admin_headers)
    res = await client.post(
        "/api/v1/playdates",
        json={
            "park_id": park_id,
            "host_dog_id": dog_id,
            "scheduled_for": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
        },
        headers=auth_headers,
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_list_upcoming_by_park(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    park_id, dog_id = await _make_park_and_dog(client, auth_headers, admin_headers)
    await client.post(
        "/api/v1/playdates",
        json={
            "park_id": park_id,
            "host_dog_id": dog_id,
            "scheduled_for": _future_iso(120),
        },
        headers=auth_headers,
    )
    res = await client.get(
        "/api/v1/playdates/upcoming",
        params={"park_id": park_id},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_rsvp_flow(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    park_id, host_dog_id = await _make_park_and_dog(client, auth_headers, admin_headers)
    pd = await client.post(
        "/api/v1/playdates",
        json={
            "park_id": park_id,
            "host_dog_id": host_dog_id,
            "scheduled_for": _future_iso(90),
        },
        headers=auth_headers,
    )
    playdate_id = pd.json()["id"]

    # Admin user creates their own dog and RSVPs
    other_dog = await client.post(
        "/api/v1/dogs", json={"name": "Buddy"}, headers=admin_headers
    )
    other_dog_id = other_dog.json()["id"]

    rsvp = await client.post(
        f"/api/v1/playdates/{playdate_id}/rsvp",
        json={"dog_id": other_dog_id, "status": "going"},
        headers=admin_headers,
    )
    assert rsvp.status_code == 201
    assert rsvp.json()["status"] == "going"

    detail = await client.get(
        f"/api/v1/playdates/{playdate_id}", headers=auth_headers
    )
    assert detail.json()["going_count"] == 2

    # Change RSVP status (upsert)
    rsvp2 = await client.post(
        f"/api/v1/playdates/{playdate_id}/rsvp",
        json={"dog_id": other_dog_id, "status": "maybe"},
        headers=admin_headers,
    )
    assert rsvp2.status_code == 201
    assert rsvp2.json()["status"] == "maybe"

    # Remove RSVP
    rm = await client.delete(
        f"/api/v1/playdates/{playdate_id}/rsvp/{other_dog_id}",
        headers=admin_headers,
    )
    assert rm.status_code == 200


@pytest.mark.asyncio
async def test_cancel_playdate_host_only(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    park_id, dog_id = await _make_park_and_dog(client, auth_headers, admin_headers)
    pd = await client.post(
        "/api/v1/playdates",
        json={
            "park_id": park_id,
            "host_dog_id": dog_id,
            "scheduled_for": _future_iso(60),
        },
        headers=auth_headers,
    )
    playdate_id = pd.json()["id"]

    # Non-host cannot cancel... unless they are admin, which admin_headers is.
    # Use a fresh regular user instead — the simple path: cancel as admin succeeds.
    # First, confirm a different *regular* user is forbidden by using a new signup.
    import uuid as _uuid
    other = await client.post(
        "/api/v1/auth/signup",
        json={
            "email": f"other-{_uuid.uuid4().hex[:8]}@fetchapp.dev",
            "password": "testpass123",
            "display_name": "Other",
        },
    )
    other_token = other.json()["tokens"]["access_token"]
    other_headers = {"Authorization": f"Bearer {other_token}"}
    forbidden = await client.delete(
        f"/api/v1/playdates/{playdate_id}", headers=other_headers
    )
    assert forbidden.status_code == 403

    # Host can cancel
    cancel = await client.delete(
        f"/api/v1/playdates/{playdate_id}", headers=auth_headers
    )
    assert cancel.status_code == 200
