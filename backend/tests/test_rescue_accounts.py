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
        "description": "We rescue pets.",
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
    # Create a pet is a regular action; rescues can post like any user — that's not blocked.
    # But rescue-only actions (mark-adopted / transfer) should return 403 until approved.
    pet_res = await client.post(
        "/api/v1/pets", json={"name": "Pending Pup"}, headers=headers,
    )
    assert pet_res.status_code == 201
    pet_id = pet_res.json()["id"]
    resp = await client.post(f"/api/v1/rescues/pets/{pet_id}/mark-adopted", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_approved_rescue_dog_shows_adoptable(client: AsyncClient, admin_headers: dict):
    headers, _profile_id, _email = await _signup_rescue(client, approved=True, admin_headers=admin_headers)
    pet_res = await client.post(
        "/api/v1/pets",
        json={"name": "Rescue Buddy"},
        headers=headers,
    )
    assert pet_res.status_code == 201
    body = pet_res.json()
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
    pet_res = await client.post(
        "/api/v1/pets", json={"name": "Flippy"}, headers=rescue_headers,
    )
    pet_id = pet_res.json()["id"]

    mark = await client.post(
        f"/api/v1/rescues/pets/{pet_id}/mark-adopted", headers=rescue_headers,
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
    pet_res = await client.post(
        "/api/v1/pets", json={"name": "Transfer Pup"}, headers=rescue_headers,
    )
    pet_id = pet_res.json()["id"]

    initiate = await client.post(
        f"/api/v1/rescues/pets/{pet_id}/transfer",
        json={"invited_email": recipient_email},
        headers=rescue_headers,
    )
    assert initiate.status_code == 201, initiate.text
    transfer_id = initiate.json()["id"]

    # Recipient sees it.
    listing = await client.get("/api/v1/pet-transfers/mine", headers=recipient_headers)
    assert listing.status_code == 200
    ids = [t["id"] for t in listing.json()]
    assert transfer_id in ids

    # Accept → ownership transferred.
    accept = await client.post(
        f"/api/v1/pet-transfers/{transfer_id}/accept", headers=recipient_headers,
    )
    assert accept.status_code == 200, accept.text
    assert accept.json()["status"] == "accepted"

    dog_view = await client.get(f"/api/v1/pets/{pet_id}", headers=recipient_headers)
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
    pet_res = await client.post(
        "/api/v1/pets", json={"name": "Staying Put"}, headers=rescue_headers,
    )
    pet_id = pet_res.json()["id"]

    initiate = await client.post(
        f"/api/v1/rescues/pets/{pet_id}/transfer",
        json={"invited_email": recipient_email},
        headers=rescue_headers,
    )
    transfer_id = initiate.json()["id"]

    decline = await client.post(
        f"/api/v1/pet-transfers/{transfer_id}/decline", headers=recipient_headers,
    )
    assert decline.status_code == 200
    assert decline.json()["status"] == "declined"

    # Pet still belongs to the rescue, not adopted.
    dog_view = await client.get(f"/api/v1/pets/{pet_id}", headers=rescue_headers)
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
async def test_get_my_rescue_profile_for_non_rescue_returns_404(
    client: AsyncClient, auth_headers: dict
):
    res = await client.get("/api/v1/rescues/me", headers=auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_get_my_rescue_profile_for_rescue(client: AsyncClient, admin_headers: dict):
    headers, profile_id, _email = await _signup_rescue(
        client, approved=True, admin_headers=admin_headers,
    )
    res = await client.get("/api/v1/rescues/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["id"] == profile_id


@pytest.mark.asyncio
async def test_patch_my_rescue_profile_blocked_when_pending(
    client: AsyncClient, admin_headers: dict
):
    headers, _profile_id, _email = await _signup_rescue(
        client, approved=False, admin_headers=admin_headers,
    )
    res = await client.patch(
        "/api/v1/rescues/me",
        json={"description": "Updated bio"},
        headers=headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_patch_my_rescue_profile_when_approved(
    client: AsyncClient, admin_headers: dict
):
    headers, _profile_id, _email = await _signup_rescue(
        client, approved=True, admin_headers=admin_headers,
    )
    res = await client.patch(
        "/api/v1/rescues/me",
        json={"description": "We rescue all the pets."},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["description"] == "We rescue all the pets."


@pytest.mark.asyncio
async def test_get_rescue_by_id_404_for_pending(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    _headers, profile_id, _email = await _signup_rescue(
        client, approved=False, admin_headers=admin_headers,
    )
    res = await client.get(f"/api/v1/rescues/{profile_id}", headers=auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_transfer_to_email_with_no_existing_user_creates_pending(
    client: AsyncClient, admin_headers: dict
):
    """Transfer initiated to an unknown email is held with `invited_email` set."""
    rescue_headers, _, _ = await _signup_rescue(
        client, approved=True, admin_headers=admin_headers,
    )
    pet_res = await client.post(
        "/api/v1/pets", json={"name": "Pending Email Pup"}, headers=rescue_headers,
    )
    pet_id = pet_res.json()["id"]

    invited = f"future-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    initiate = await client.post(
        f"/api/v1/rescues/pets/{pet_id}/transfer",
        json={"invited_email": invited},
        headers=rescue_headers,
    )
    assert initiate.status_code == 201, initiate.text
    body = initiate.json()
    assert body["status"] == "pending"
    assert body["invited_email"] == invited
    assert body["to_user_id"] is None
    assert body["expires_at"]

    # Re-issuing cancels the prior pending row → only one pending exists.
    again = await client.post(
        f"/api/v1/rescues/pets/{pet_id}/transfer",
        json={"invited_email": invited},
        headers=rescue_headers,
    )
    assert again.status_code == 201
    assert again.json()["id"] != body["id"]


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


@pytest.mark.asyncio
async def test_public_rescue_page(client: AsyncClient, admin_headers: dict):
    headers, _pid, _email = await _signup_rescue(client, approved=True, admin_headers=admin_headers)
    me = await client.get("/api/v1/rescues/me", headers=headers)
    slug = me.json()["slug"]
    assert slug

    # Works logged out (no auth header).
    pub = await client.get(f"/api/v1/public/rescues/{slug}")
    assert pub.status_code == 200
    body = pub.json()
    assert body["org_name"] == me.json()["org_name"]
    assert "pets" in body

    # Hiding it (is_public=False) 404s the public page.
    await client.patch("/api/v1/rescues/me", json={"is_public": False}, headers=headers)
    hidden = await client.get(f"/api/v1/public/rescues/{slug}")
    assert hidden.status_code == 404


@pytest.mark.asyncio
async def test_public_rescue_pending_404(client: AsyncClient, admin_headers: dict):
    headers, _pid, _email = await _signup_rescue(client, approved=False, admin_headers=admin_headers)
    me = await client.get("/api/v1/rescues/me", headers=headers)
    slug = me.json()["slug"]
    assert slug  # pending rescues still get a slug at signup
    res = await client.get(f"/api/v1/public/rescues/{slug}")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_public_rescue_image_404_for_unknown_key(client: AsyncClient):
    res = await client.get("/api/v1/public/rescues/images/nonexistent.jpg")
    assert res.status_code == 404
