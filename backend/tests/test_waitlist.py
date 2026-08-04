import uuid

import pytest
from httpx import AsyncClient

from app.config import settings


def _email() -> str:
    return f"waitlist-{uuid.uuid4().hex[:8]}@fetchapp.dev"


async def _join(client: AsyncClient, email: str | None = None) -> str:
    email = email or _email()
    res = await client.post("/api/v1/waitlist", json={"email": email})
    assert res.status_code == 202
    return email


async def _get_entry(client: AsyncClient, admin_headers: dict, email: str) -> dict:
    res = await client.get("/api/v1/waitlist", headers=admin_headers)
    return next(e for e in res.json() if e["email"] == email)


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


# --- One-click invite ---

@pytest.mark.asyncio
async def test_invite_marks_entry_and_creates_unused_code(
    client: AsyncClient, admin_headers: dict
):
    email = await _join(client)
    entry = await _get_entry(client, admin_headers, email)
    assert entry["invited_at"] is None

    res = await client.post(f"/api/v1/waitlist/{entry['id']}/invite", headers=admin_headers)
    assert res.status_code == 200, res.text
    body = res.json()
    code = body["code"]
    assert code.startswith("FETCH-")
    assert body["email"] == email
    assert body["signup_url"].endswith(f"/signup?invite={code}")
    assert body["email_sent"] is False  # no email provider configured in tests

    # The waitlist entry now reflects invited status.
    entry = await _get_entry(client, admin_headers, email)
    assert entry["invited_at"] is not None
    assert entry["invite_code"] == code

    # A matching, still-unused invite code was minted.
    invites = (await client.get("/api/v1/invites", headers=admin_headers)).json()
    match = next(i for i in invites if i["code"] == code)
    assert match["is_used"] is False


@pytest.mark.asyncio
async def test_invite_resend_reuses_unused_code(client: AsyncClient, admin_headers: dict):
    email = await _join(client)
    entry = await _get_entry(client, admin_headers, email)
    first = (await client.post(f"/api/v1/waitlist/{entry['id']}/invite", headers=admin_headers)).json()
    second = (await client.post(f"/api/v1/waitlist/{entry['id']}/invite", headers=admin_headers)).json()
    assert first["code"] == second["code"]
    # Re-send did not mint a duplicate code row.
    invites = (await client.get("/api/v1/invites", headers=admin_headers)).json()
    assert sum(1 for i in invites if i["code"] == first["code"]) == 1


@pytest.mark.asyncio
async def test_invite_after_code_used_mints_new(
    client: AsyncClient, admin_headers: dict, monkeypatch
):
    email = await _join(client)
    entry = await _get_entry(client, admin_headers, email)
    code1 = (
        await client.post(f"/api/v1/waitlist/{entry['id']}/invite", headers=admin_headers)
    ).json()["code"]

    # Consume code1 via a gated signup.
    monkeypatch.setattr(settings, "INVITE_REQUIRED", True)
    signup = await client.post("/api/v1/auth/signup", json={
        "email": _email(), "password": "password123",
        "display_name": "Invitee", "invite_code": code1,
    })
    assert signup.status_code == 201, signup.text

    # Re-inviting now mints a fresh code (the old one can't be reused).
    code2 = (
        await client.post(f"/api/v1/waitlist/{entry['id']}/invite", headers=admin_headers)
    ).json()["code"]
    assert code2 != code1


@pytest.mark.asyncio
async def test_invite_missing_entry_404(client: AsyncClient, admin_headers: dict):
    res = await client.post(f"/api/v1/waitlist/{uuid.uuid4()}/invite", headers=admin_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_invite_requires_admin(client: AsyncClient, auth_headers: dict):
    # The admin gate runs before the handler, so a non-admin gets 403 regardless.
    res = await client.post(f"/api/v1/waitlist/{uuid.uuid4()}/invite", headers=auth_headers)
    assert res.status_code == 403


# --- Invite lookup (signup-form prefill) ---

async def _invite(client: AsyncClient, admin_headers: dict, email: str) -> str:
    """Waitlist `email`, then admin-invite them; returns the minted code."""
    await _join(client, email)
    entry = await _get_entry(client, admin_headers, email)
    res = await client.post(
        f"/api/v1/waitlist/{entry['id']}/invite", headers=admin_headers
    )
    assert res.status_code == 200, res.text
    return res.json()["code"]


@pytest.mark.asyncio
async def test_invite_lookup_returns_invited_email(client: AsyncClient, admin_headers: dict):
    email = _email()
    code = await _invite(client, admin_headers, email)

    res = await client.get(f"/api/v1/public/invite/{code}")
    assert res.status_code == 200, res.text
    assert res.json() == {"status": "valid", "email": email}


@pytest.mark.asyncio
async def test_invite_lookup_is_case_insensitive(client: AsyncClient, admin_headers: dict):
    """Signup upper-cases the code, so the lookup must agree — otherwise a
    hand-typed code reads as unknown and then signs up fine."""
    email = _email()
    code = await _invite(client, admin_headers, email)

    res = await client.get(f"/api/v1/public/invite/{code.lower()}")
    assert res.status_code == 200
    assert res.json()["email"] == email


@pytest.mark.asyncio
async def test_invite_lookup_unknown_code(client: AsyncClient):
    res = await client.get("/api/v1/public/invite/FETCH-NOTREAL")
    assert res.status_code == 200
    assert res.json() == {"status": "unknown", "email": None}


@pytest.mark.asyncio
async def test_invite_lookup_admin_code_has_no_email(client: AsyncClient, admin_headers: dict):
    """Admin-minted codes aren't tied to anyone, so there's nothing to prefill."""
    made = await client.post("/api/v1/invites/generate", json={"count": 1},
                             headers=admin_headers)
    assert made.status_code == 201, made.text
    code = made.json()[0]["code"]

    res = await client.get(f"/api/v1/public/invite/{code}")
    assert res.status_code == 200
    assert res.json() == {"status": "valid", "email": None}


@pytest.mark.asyncio
async def test_invite_lookup_hides_email_once_used(client: AsyncClient, admin_headers: dict,
                                                   monkeypatch):
    """A consumed code stops disclosing the address it was issued to."""
    email = _email()
    code = await _invite(client, admin_headers, email)

    monkeypatch.setattr(settings, "INVITE_REQUIRED", True)
    signed = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123",
        "display_name": "Invited", "invite_code": code,
    })
    assert signed.status_code == 201, signed.text

    res = await client.get(f"/api/v1/public/invite/{code}")
    assert res.status_code == 200
    assert res.json() == {"status": "used", "email": None}
