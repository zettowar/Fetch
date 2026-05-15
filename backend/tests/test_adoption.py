"""Smoke tests for the adoption-inquiry endpoints."""
import uuid

import pytest
from httpx import AsyncClient


async def _create_approved_rescue(client: AsyncClient) -> tuple[str, dict]:
    """Sign up a rescue, approve them in the DB, and return (rescue_id, rescue_headers)."""
    email = f"rescue-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    r = await client.post("/api/v1/auth/signup-rescue", json={
        "email": email,
        "password": "password123",
        "org_name": "Test Rescue",
        "description": "We rescue dogs.",
        "location": "Somewhere",
    })
    assert r.status_code == 201, r.text
    headers = {"Authorization": f"Bearer {r.json()['tokens']['access_token']}"}

    # Approve in the DB directly.
    from tests.conftest import test_session_factory
    from app.models.rescue import RescueProfile
    from sqlalchemy import select

    async with test_session_factory() as db:
        res = await db.execute(select(RescueProfile).where(RescueProfile.org_name == "Test Rescue"))
        # Approve the most recent one.
        profile = list(res.scalars().all())[-1]
        profile.status = "approved"
        await db.commit()
        rescue_id = str(profile.id)

    return rescue_id, headers


@pytest.mark.asyncio
async def test_submit_inquiry_creates_record(client: AsyncClient, auth_headers: dict):
    rescue_id, _ = await _create_approved_rescue(client)

    res = await client.post(
        f"/api/v1/rescues/{rescue_id}/inquiries",
        json={
            "name": "Jane Doe",
            "email": "jane@example.com",
            "phone": "555-0123",
            "message": "I want to adopt!",
        },
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Jane Doe"
    assert body["status"] == "new"
    assert body["rescue_id"] == rescue_id


@pytest.mark.asyncio
async def test_submit_inquiry_404_for_unknown_rescue(client: AsyncClient, auth_headers: dict):
    fake = str(uuid.uuid4())
    res = await client.post(
        f"/api/v1/rescues/{fake}/inquiries",
        json={"name": "X", "email": "x@example.com", "message": "hi"},
        headers=auth_headers,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_rescue_can_list_and_update_inquiries(client: AsyncClient, auth_headers: dict):
    rescue_id, rescue_headers = await _create_approved_rescue(client)

    # Inquirer submits.
    submit = await client.post(
        f"/api/v1/rescues/{rescue_id}/inquiries",
        json={"name": "A", "email": "a@example.com", "message": "interested"},
        headers=auth_headers,
    )
    assert submit.status_code == 201
    inquiry_id = submit.json()["id"]

    # Rescue lists.
    listing = await client.get("/api/v1/rescues/me/inquiries", headers=rescue_headers)
    assert listing.status_code == 200
    assert any(q["id"] == inquiry_id for q in listing.json())

    # Rescue marks contacted.
    upd = await client.patch(
        f"/api/v1/rescues/me/inquiries/{inquiry_id}",
        json={"status": "contacted"},
        headers=rescue_headers,
    )
    assert upd.status_code == 200
    assert upd.json()["status"] == "contacted"


@pytest.mark.asyncio
async def test_non_rescue_cannot_list_inquiries(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/rescues/me/inquiries", headers=auth_headers)
    assert res.status_code == 403
