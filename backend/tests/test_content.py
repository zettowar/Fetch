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
async def test_submit_rescue(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/rescues", json={
        "name": "Happy Paws Rescue",
        "description": "We rescue dogs in need",
        "website": "https://happypaws.org",
        "donation_url": "https://happypaws.org/donate",
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["verified"] is False


@pytest.mark.asyncio
async def test_list_rescues_verified_only(client: AsyncClient, auth_headers: dict):
    # Submit unverified rescue
    await client.post("/api/v1/rescues", json={
        "name": "Unverified Rescue",
        "description": "We rescue dogs",
    }, headers=auth_headers)

    # List with verified_only=true (default)
    res = await client.get("/api/v1/rescues", headers=auth_headers)
    assert res.status_code == 200
    # All returned should be verified
    for r in res.json():
        assert r["verified"] is True


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
