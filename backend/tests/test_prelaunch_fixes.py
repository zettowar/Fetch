"""Regression tests for the pre-launch hardening pass:

- server-side swipe quota enforcement (was localStorage-only)
- block enforcement on direct pet reads / votes / reactions (feed-only before)
- stale pet-transfer acceptance guard
- digest-email HTML escaping
"""
import uuid

import pytest
from httpx import AsyncClient


async def _signup(client: AsyncClient, tag: str) -> tuple[str, dict]:
    email = f"{tag}-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": f"{tag}",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    return body["user"]["id"], {"Authorization": f"Bearer {body['tokens']['access_token']}"}


async def _make_pet(client: AsyncClient, headers: dict, name: str = "Pup") -> str:
    res = await client.post("/api/v1/pets", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


# --- Swipe quota -----------------------------------------------------------

@pytest.mark.asyncio
async def test_quota_endpoint_shape(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/votes/quota", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["used"] == 0
    assert data["cap"] == 50
    assert data["remaining"] == 50
    assert data["unlimited"] is False


@pytest.mark.asyncio
async def test_vote_increments_used(client: AsyncClient, auth_headers: dict):
    _, target = await _signup(client, "quota-target")
    pet_id = await _make_pet(client, target)
    await client.post("/api/v1/votes", json={"pet_id": pet_id, "value": 1}, headers=auth_headers)
    res = await client.get("/api/v1/votes/quota", headers=auth_headers)
    assert res.json()["used"] == 1
    assert res.json()["remaining"] == 49


@pytest.mark.asyncio
async def test_reward_raises_cap(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/votes/quota/reward", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["cap"] == 75  # 50 + one 25 increment


@pytest.mark.asyncio
async def test_quota_enforced_server_side(client: AsyncClient, auth_headers: dict, monkeypatch):
    """Past the cap, casting a vote returns 429 — enforcement lives on the
    server, not in the browser."""
    from app.services import quota as quota_service

    monkeypatch.setattr(quota_service, "FREE_DAILY", 1)
    monkeypatch.setattr(quota_service, "MAX_DAILY", 1)

    _, t1 = await _signup(client, "cap-a")
    _, t2 = await _signup(client, "cap-b")
    p1 = await _make_pet(client, t1)
    p2 = await _make_pet(client, t2)

    first = await client.post("/api/v1/votes", json={"pet_id": p1, "value": 1}, headers=auth_headers)
    assert first.status_code == 201
    second = await client.post("/api/v1/votes", json={"pet_id": p2, "value": 1}, headers=auth_headers)
    assert second.status_code == 429


# --- Block enforcement on direct APIs --------------------------------------

async def _block(client: AsyncClient, blocker_headers: dict, blocked_id: str) -> None:
    res = await client.post(f"/api/v1/users/{blocked_id}/block", headers=blocker_headers)
    assert res.status_code == 201, res.text


@pytest.mark.asyncio
async def test_blocked_user_cannot_read_or_vote_or_react(client: AsyncClient):
    victim_id, victim = await _signup(client, "victim")
    attacker_id, attacker = await _signup(client, "attacker")
    pet_id = await _make_pet(client, victim, "Hidden")

    # Victim blocks the attacker.
    await _block(client, victim, attacker_id)

    # Direct read is 404 (indistinguishable from nonexistent).
    got = await client.get(f"/api/v1/pets/{pet_id}", headers=attacker)
    assert got.status_code == 404

    # Listing the victim's pets returns nothing.
    listed = await client.get(f"/api/v1/pets/by-user/{victim_id}", headers=attacker)
    assert listed.status_code == 200
    assert listed.json() == []

    # Voting is blocked.
    voted = await client.post(
        "/api/v1/votes", json={"pet_id": pet_id, "value": 1}, headers=attacker
    )
    assert voted.status_code == 404

    # Reacting is blocked.
    reacted = await client.post(
        "/api/v1/social/reactions",
        json={"target_type": "pet", "target_id": pet_id, "kind": "cute"},
        headers=attacker,
    )
    assert reacted.status_code == 404


# --- Stale transfer guard --------------------------------------------------

@pytest.mark.asyncio
async def test_accepting_stale_transfer_after_adoption_is_rejected(
    client: AsyncClient, admin_headers: dict
):
    # Approved rescue with a pet.
    rescue_email = f"rescue-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup-rescue", json={
        "email": rescue_email, "password": "password123",
        "org_name": "Guard Rescue", "description": "test",
    })
    assert signup.status_code == 201, signup.text
    rescue_headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}
    profile_id = signup.json()["rescue_profile"]["id"]
    review = await client.post(
        f"/api/v1/admin/rescue-profiles/{profile_id}/review",
        json={"approve": True}, headers=admin_headers,
    )
    assert review.status_code == 200, review.text

    pet_id = await _make_pet(client, rescue_headers, "GuardPup")
    adopter_id, adopter = await _signup(client, "adopter")

    # Start a transfer to the adopter (still pending).
    transfer = await client.post(
        f"/api/v1/rescues/pets/{pet_id}/transfer",
        json={"target_user_id": adopter_id}, headers=rescue_headers,
    )
    assert transfer.status_code in (200, 201), transfer.text
    transfer_id = transfer.json()["id"]

    # Rescue instead marks the pet adopted externally.
    marked = await client.post(
        f"/api/v1/rescues/pets/{pet_id}/mark-adopted", headers=rescue_headers
    )
    assert marked.status_code == 200, marked.text

    # The now-stale transfer can no longer be accepted. mark_adopted cancels
    # pending transfers (→400 "cancelled"); the accept-side guard is the 409
    # backstop for any path that leaves one pending. Either is a valid refusal.
    accept = await client.post(
        f"/api/v1/pet-transfers/{transfer_id}/accept", headers=adopter
    )
    assert accept.status_code in (400, 409), accept.text

    # The security property that matters: ownership did NOT flip to the adopter.
    mine = await client.get("/api/v1/pets/mine", headers=adopter)
    assert mine.status_code == 200, mine.text
    assert all(p["id"] != pet_id for p in mine.json())


# --- Digest escaping -------------------------------------------------------

def test_digest_escapes_user_content():
    """A notification title/body containing markup is HTML-escaped in the
    digest email, not injected raw."""
    from types import SimpleNamespace
    from app.tasks.digest import _render_items

    unread = [
        SimpleNamespace(title="<img src=x onerror=alert(1)>", body="<b>hi</b>"),
        SimpleNamespace(title="normal", body=None),
    ]
    rendered = _render_items(unread)
    assert "<img" not in rendered
    assert "&lt;img src=x onerror=alert(1)&gt;" in rendered
    assert "<b>hi</b>" not in rendered
    assert "&lt;b&gt;hi&lt;/b&gt;" in rendered
    # Our own markup (the <li>/<strong> shell) is still real HTML.
    assert "<strong>normal</strong>" in rendered
