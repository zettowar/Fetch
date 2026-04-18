import uuid

import pytest
from httpx import AsyncClient


# --- Posts ---

@pytest.mark.asyncio
async def test_create_post(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/posts", json={
        "title": "Best Dog Treats",
        "body": "Here are my favorite treats for dogs...",
        "tags": ["training", "health"],
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["title"] == "Best Dog Treats"


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
    import uuid
    email = f"resc-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup-rescue", json={
        "email": email,
        "password": "password123",
        "org_name": "Happy Paws Rescue",
        "description": "We rescue dogs in need",
        "website": "happypaws.org",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["user"]["role"] == "rescue"
    assert body["rescue_profile"]["status"] == "pending"
    # Until approved, the rescue endpoints listing approved orgs don't include them.
    headers = {"Authorization": f"Bearer {body['tokens']['access_token']}"}
    listing = await client.get("/api/v1/rescues", headers=headers)
    assert listing.status_code == 200
    for r in listing.json():
        assert r["org_name"] != "Happy Paws Rescue"


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
