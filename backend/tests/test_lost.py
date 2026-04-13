import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_missing_report(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Lost golden retriever near the park",
        "last_seen_lat": 37.7749,
        "last_seen_lng": -122.4194,
    }, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["kind"] == "missing"
    assert data["status"] == "open"
    assert data["description"] == "Lost golden retriever near the park"


@pytest.mark.asyncio
async def test_create_found_report_new_account_blocked(client: AsyncClient):
    """New accounts (< 7 days old) cannot report found dogs."""
    email = f"newuser-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "New User"
    })
    token = signup_res.json()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.post("/api/v1/lost/reports", json={
        "kind": "found",
        "description": "Found a small brown dog",
        "last_seen_lat": 37.77,
        "last_seen_lng": -122.42,
    }, headers=headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_report(client: AsyncClient, auth_headers: dict):
    # Create
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Test dog missing",
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    # Get
    res = await client.get(f"/api/v1/lost/reports/{report_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == report_id


@pytest.mark.asyncio
async def test_resolve_report(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Will resolve this",
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    res = await client.post(f"/api/v1/lost/reports/{report_id}/resolve", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "resolved"


@pytest.mark.asyncio
async def test_add_sighting(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Missing dog with sighting",
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    # Add sighting as another user
    email = f"sighter-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Sighter"
    })
    sighter_headers = {"Authorization": f"Bearer {signup_res.json()['tokens']['access_token']}"}

    res = await client.post(f"/api/v1/lost/reports/{report_id}/sightings", json={
        "lat": 37.78,
        "lng": -122.41,
        "note": "Saw this dog near the coffee shop",
    }, headers=sighter_headers)
    assert res.status_code == 201
    assert res.json()["note"] == "Saw this dog near the coffee shop"


@pytest.mark.asyncio
async def test_nearby_reports(client: AsyncClient, auth_headers: dict):
    # Create a report with coordinates
    await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Near test",
        "last_seen_lat": 37.7749,
        "last_seen_lng": -122.4194,
    }, headers=auth_headers)

    res = await client.get(
        "/api/v1/lost/reports/nearby",
        params={"lat": 37.77, "lng": -122.42, "radius_km": 10},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    # Should find at least our report
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_create_subscription(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/lost/subscriptions", json={
        "home_lat": 37.7749,
        "home_lng": -122.4194,
        "radius_km": 15,
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["radius_km"] == 15


@pytest.mark.asyncio
async def test_get_my_subscription(client: AsyncClient, auth_headers: dict):
    # Create first
    await client.post("/api/v1/lost/subscriptions", json={
        "home_lat": 37.77, "home_lng": -122.42, "radius_km": 10,
    }, headers=auth_headers)

    res = await client.get("/api/v1/lost/subscriptions/mine", headers=auth_headers)
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_contact_reporter(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "description": "Contact test"
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    # Contact as another user
    email = f"contacter-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup_res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Contacter"
    })
    other_headers = {"Authorization": f"Bearer {signup_res.json()['tokens']['access_token']}"}

    res = await client.post(f"/api/v1/lost/reports/{report_id}/contact", json={
        "message": "I think I saw your dog!"
    }, headers=other_headers)
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_cannot_contact_self(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "description": "Self contact test"
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    res = await client.post(f"/api/v1/lost/reports/{report_id}/contact", json={
        "message": "Trying to contact myself"
    }, headers=auth_headers)
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_lost_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/lost/reports/nearby", params={"lat": 37, "lng": -122, "radius_km": 5})
    assert res.status_code in (401, 403)
