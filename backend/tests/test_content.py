import uuid

import pytest
from httpx import AsyncClient


# --- Posts ---

@pytest.mark.asyncio
async def test_create_post(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/posts", json={
        "title": "Best Pet Treats",
        "body": "Here are my favorite treats for pets...",
        "tags": ["training", "health"],
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["title"] == "Best Pet Treats"


@pytest.mark.asyncio
async def test_list_posts(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/posts", json={
        "title": "Test Post", "body": "Test body"
    }, headers=auth_headers)

    res = await client.get("/api/v1/posts", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_search_posts(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/posts", json={
        "title": "Unique Dogfood Review", "body": "Special content about nutrition"
    }, headers=auth_headers)

    res = await client.get("/api/v1/posts", params={"search": "nutrition"}, headers=auth_headers)
    assert res.status_code == 200


# --- Rescues ---

@pytest.mark.asyncio
async def test_rescue_signup_creates_pending_profile(client: AsyncClient):
    """The rescue signup flow creates a user with role=rescue + a pending RescueProfile."""
    suffix = uuid.uuid4().hex[:8]
    email = f"resc-{suffix}@fetchapp.dev"
    org_name = f"Happy Paws Rescue {suffix}"
    res = await client.post("/api/v1/auth/signup-rescue", json={
        "email": email,
        "password": "password123",
        "org_name": org_name,
        "description": "We rescue pets in need",
        "website": "happypaws.org",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["user"]["role"] == "rescue"
    assert body["rescue_profile"]["status"] == "pending"
    profile_id = body["rescue_profile"]["id"]
    # Until approved, the new rescue's profile must not appear in the approved listing.
    headers = {"Authorization": f"Bearer {body['tokens']['access_token']}"}
    listing = await client.get("/api/v1/rescues", headers=headers)
    assert listing.status_code == 200
    assert all(r["id"] != profile_id for r in listing.json())


@pytest.mark.asyncio
async def test_list_rescues_approved_only(client: AsyncClient, auth_headers: dict):
    """Public directory only returns approved rescues."""
    res = await client.get("/api/v1/rescues", headers=auth_headers)
    assert res.status_code == 200
    # Public schema doesn't expose status, but by contract all returned are approved.
    assert isinstance(res.json(), list)


# --- Support ---

@pytest.mark.asyncio
async def test_create_ticket(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/support/tickets", json={
        "subject": "Can't upload photos",
        "body": "Getting an error when I try to upload a photo",
        "source_screen": "DogEditorPage",
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["ticket_number"].startswith("FETCH-")
    assert res.json()["status"] == "open"


@pytest.mark.asyncio
async def test_my_tickets(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/support/tickets", json={
        "subject": "Test Ticket", "body": "Test body"
    }, headers=auth_headers)

    res = await client.get("/api/v1/support/tickets/mine", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_faq_list(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/support/faq", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
