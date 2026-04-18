import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_park_admin_only(client: AsyncClient, admin_headers: dict):
    """Park creation is admin-gated; regular users are 403 (see test below)."""
    res = await client.post("/api/v1/parks", json={
        "name": "Central Dog Park",
        "lat": 37.7749,
        "lng": -122.4194,
        "address": "123 Park Ave",
        "attributes": {"fenced": True, "water": True},
    }, headers=admin_headers)
    assert res.status_code == 201, res.text
    assert res.json()["name"] == "Central Dog Park"


@pytest.mark.asyncio
async def test_create_park_forbidden_for_regular_user(
    client: AsyncClient, auth_headers: dict,
):
    res = await client.post("/api/v1/parks", json={
        "name": "User Tried", "lat": 0, "lng": 0,
    }, headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_park(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    create_res = await client.post("/api/v1/parks", json={
        "name": "Get Park", "lat": 37.78, "lng": -122.42
    }, headers=admin_headers)
    park_id = create_res.json()["id"]

    res = await client.get(f"/api/v1/parks/{park_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Get Park"


@pytest.mark.asyncio
async def test_nearby_parks(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    await client.post("/api/v1/parks", json={
        "name": "Nearby Park", "lat": 37.77, "lng": -122.42
    }, headers=admin_headers)

    res = await client.get("/api/v1/parks/nearby", params={
        "lat": 37.77, "lng": -122.42, "radius_km": 5
    }, headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_create_review(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    create_res = await client.post("/api/v1/parks", json={
        "name": "Review Park", "lat": 37.78, "lng": -122.42
    }, headers=admin_headers)
    park_id = create_res.json()["id"]

    res = await client.post(f"/api/v1/parks/{park_id}/reviews", json={
        "rating": 4,
        "body": "Great park!",
        "crowd_level": "moderate",
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["rating"] == 4


@pytest.mark.asyncio
async def test_create_incident(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    create_res = await client.post("/api/v1/parks", json={
        "name": "Incident Park", "lat": 37.78, "lng": -122.42
    }, headers=admin_headers)
    park_id = create_res.json()["id"]

    res = await client.post(f"/api/v1/parks/{park_id}/incidents", json={
        "kind": "aggressive_dog",
        "description": "Large dog off leash being aggressive",
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["kind"] == "aggressive_dog"


@pytest.mark.asyncio
async def test_checkin(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    create_res = await client.post("/api/v1/parks", json={
        "name": "Checkin Park", "lat": 37.78, "lng": -122.42
    }, headers=admin_headers)
    park_id = create_res.json()["id"]

    dog_res = await client.post("/api/v1/dogs", json={"name": "CheckinDog"}, headers=auth_headers)
    dog_id = dog_res.json()["id"]

    res = await client.post(
        f"/api/v1/parks/{park_id}/checkin",
        json={"dog_id": dog_id},
        headers=auth_headers,
    )
    assert res.status_code == 201


@pytest.mark.asyncio
async def test_parks_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/parks/nearby", params={"lat": 37, "lng": -122, "radius_km": 5})
    assert res.status_code in (401, 403)
