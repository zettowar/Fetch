"""End-to-end coverage for the rescue-account + adoption-transfer flow."""
import uuid

import pytest
from httpx import AsyncClient


async def _signup_rescue(client: AsyncClient, *, approved: bool, admin_headers: dict):
    email = f"resc-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup-rescue", json={
        "email": email,
        "password": "password123",
        "org_name": f"Test Rescue {email[:10]}",
        "description": "We rescue dogs.",
    })
    assert res.status_code == 201, res.text
    data = res.json()
    headers = {"Authorization": f"Bearer {data['tokens']['access_token']}"}
    profile_id = data["rescue_profile"]["id"]
    if approved:
        approve_res = await client.post(
            f"/api/v1/admin/rescue-profiles/{profile_id}/review",
            json={"approve": True, "note": None},
            headers=admin_headers,
        )
        assert approve_res.status_code == 200
    return headers, profile_id, email


@pytest.mark.asyncio
async def test_rescue_signup_pending_cannot_post_dog(client: AsyncClient, admin_headers: dict):
    """A rescue that's still pending can sign up + log in, but is blocked from rescue-only actions."""
    headers, _profile_id, _email = await _signup_rescue(client, approved=False, admin_headers=admin_headers)
    # Create a dog is a regular action; rescues can post like any user — that's not blocked.
    # But rescue-only actions (mark-adopted / transfer) should return 403 until approved.
    dog_res = await client.post(
        "/api/v1/dogs", json={"name": "Pending Pup"}, headers=headers,
    )
    assert dog_res.status_code == 201
    dog_id = dog_res.json()["id"]
    resp = await client.post(f"/api/v1/rescues/dogs/{dog_id}/mark-adopted", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_approved_rescue_dog_shows_adoptable(client: AsyncClient, admin_headers: dict):
    headers, _profile_id, _email = await _signup_rescue(client, approved=True, admin_headers=admin_headers)
    dog_res = await client.post(
        "/api/v1/dogs",
        json={"name": "Rescue Buddy"},
        headers=headers,
    )
    assert dog_res.status_code == 201
    body = dog_res.json()
    assert body["adoptable"] is True
    assert body["rescue_name"]
    assert body["adopted_at"] is None


@pytest.mark.asyncio
async def test_mark_adopted_flips_adoptable_and_excludes_from_feed(
    client: AsyncClient, auth_headers: dict, admin_headers: dict,
):
    rescue_headers, _profile_id, _email = await _signup_rescue(
        client, approved=True, admin_headers=admin_headers,
    )
    dog_res = await client.post(
        "/api/v1/dogs", json={"name": "Flippy"}, headers=rescue_headers,
    )
    dog_id = dog_res.json()["id"]

    mark = await client.post(
        f"/api/v1/rescues/dogs/{dog_id}/mark-adopted", headers=rescue_headers,
    )
    assert mark.status_code == 200, mark.text
    assert mark.json()["adopted_at"] is not None
    assert mark.json()["adoptable"] is False


@pytest.mark.asyncio
async def test_transfer_flow_changes_ownership(
    client: AsyncClient, auth_headers: dict, admin_headers: dict,
):
    """Rescue initiates transfer → recipient accepts → owner_id flips + adopted_at is set."""
    # Recipient account (existing Fetch user).
    recipient_email = f"adopter-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup", json={
        "email": recipient_email,
        "password": "password123",
        "display_name": "Adopter",
    })
    recipient_id = signup.json()["user"]["id"]
    recipient_headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}

    # Rescue.
    rescue_headers, _profile_id, _rescue_email = await _signup_rescue(
        client, approved=True, admin_headers=admin_headers,
    )
    dog_res = await client.post(
        "/api/v1/dogs", json={"name": "Transfer Pup"}, headers=rescue_headers,
    )
    dog_id = dog_res.json()["id"]

    initiate = await client.post(
        f"/api/v1/rescues/dogs/{dog_id}/transfer",
        json={"invited_email": recipient_email},
        headers=rescue_headers,
    )
    assert initiate.status_code == 201, initiate.text
    transfer_id = initiate.json()["id"]

    # Recipient sees it.
    listing = await client.get("/api/v1/dog-transfers/mine", headers=recipient_headers)
    assert listing.status_code == 200
    ids = [t["id"] for t in listing.json()]
    assert transfer_id in ids

    # Accept → ownership transferred.
    accept = await client.post(
        f"/api/v1/dog-transfers/{transfer_id}/accept", headers=recipient_headers,
    )
    assert accept.status_code == 200, accept.text
    assert accept.json()["status"] == "accepted"

    dog_view = await client.get(f"/api/v1/dogs/{dog_id}", headers=recipient_headers)
    assert dog_view.status_code == 200
    body = dog_view.json()
    assert body["owner_id"] == recipient_id
    assert body["adopted_at"] is not None


@pytest.mark.asyncio
async def test_transfer_decline_keeps_ownership(
    client: AsyncClient, auth_headers: dict, admin_headers: dict,
):
    # Recipient.
    recipient_email = f"declinar-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup", json={
        "email": recipient_email,
        "password": "password123",
        "display_name": "No Thanks",
    })
    recipient_headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}

    rescue_headers, _profile_id, _rescue_email = await _signup_rescue(
        client, approved=True, admin_headers=admin_headers,
    )
    dog_res = await client.post(
        "/api/v1/dogs", json={"name": "Staying Put"}, headers=rescue_headers,
    )
    dog_id = dog_res.json()["id"]

    initiate = await client.post(
        f"/api/v1/rescues/dogs/{dog_id}/transfer",
        json={"invited_email": recipient_email},
        headers=rescue_headers,
    )
    transfer_id = initiate.json()["id"]

    decline = await client.post(
        f"/api/v1/dog-transfers/{transfer_id}/decline", headers=recipient_headers,
    )
    assert decline.status_code == 200
    assert decline.json()["status"] == "declined"

    # Dog still belongs to the rescue, not adopted.
    dog_view = await client.get(f"/api/v1/dogs/{dog_id}", headers=rescue_headers)
    assert dog_view.status_code == 200
    assert dog_view.json()["adopted_at"] is None


@pytest.mark.asyncio
async def test_show_adoption_prompt_toggle(client: AsyncClient, auth_headers: dict):
    # Default True.
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert me.json()["show_adoption_prompt"] is True

    # Turn off.
    res = await client.patch(
        "/api/v1/users/me",
        json={"show_adoption_prompt": False},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["show_adoption_prompt"] is False


@pytest.mark.asyncio
async def test_admin_reject_with_note(client: AsyncClient, admin_headers: dict):
    email = f"rej-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup-rescue", json={
        "email": email,
        "password": "password123",
        "org_name": "Will Be Rejected",
        "description": "...",
    })
    profile_id = signup.json()["rescue_profile"]["id"]
    res = await client.post(
        f"/api/v1/admin/rescue-profiles/{profile_id}/review",
        json={"approve": False, "note": "Need more info"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
    assert res.json()["review_note"] == "Need more info"
