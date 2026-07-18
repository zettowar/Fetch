import uuid

import pytest
from httpx import AsyncClient


def _email() -> str:
    return f"waitlist-{uuid.uuid4().hex[:8]}@fetchapp.dev"


@pytest.mark.asyncio
async def test_join_waitlist(client: AsyncClient):
    res = await client.post("/api/v1/waitlist", json={"email": _email(), "source": "hero"})
    assert res.status_code == 202
    assert res.json() == {"ok": True}


@pytest.mark.asyncio
async def test_join_waitlist_duplicate_is_silent(client: AsyncClient, admin_headers: dict):
    email = _email()
    first = await client.post("/api/v1/waitlist", json={"email": email})
    # Same address again — same response, no enumeration, no second row.
    second = await client.post("/api/v1/waitlist", json={"email": email.upper()})
    assert first.status_code == second.status_code == 202
    assert first.json() == second.json()

    res = await client.get("/api/v1/waitlist", headers=admin_headers)
    emails = [e["email"] for e in res.json()]
    assert emails.count(email.lower()) == 1


@pytest.mark.asyncio
async def test_join_waitlist_invalid_email(client: AsyncClient):
    res = await client.post("/api/v1/waitlist", json={"email": "not-an-email"})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_list_waitlist_requires_admin(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/waitlist", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_admin_lists_and_deletes_entry(client: AsyncClient, admin_headers: dict):
    email = _email()
    await client.post("/api/v1/waitlist", json={"email": email, "source": "closing"})

    res = await client.get("/api/v1/waitlist", headers=admin_headers)
    assert res.status_code == 200
    assert "X-Total-Count" in res.headers
    entry = next(e for e in res.json() if e["email"] == email)
    assert entry["source"] == "closing"

    deleted = await client.delete(f"/api/v1/waitlist/{entry['id']}", headers=admin_headers)
    assert deleted.status_code == 204

    res = await client.get("/api/v1/waitlist", headers=admin_headers)
    assert email not in [e["email"] for e in res.json()]


@pytest.mark.asyncio
async def test_delete_missing_entry_404(client: AsyncClient, admin_headers: dict):
    res = await client.delete(f"/api/v1/waitlist/{uuid.uuid4()}", headers=admin_headers)
    assert res.status_code == 404
