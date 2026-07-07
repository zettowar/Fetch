"""Notification inbox: emission hooks, listing, unread counts, read state."""
import uuid

import pytest
from httpx import AsyncClient


async def _make_user(client: AsyncClient, name: str = "Inbox User") -> tuple[str, dict]:
    email = f"inbox-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": name,
    })
    assert res.status_code == 201, res.text
    return res.json()["user"]["id"], {
        "Authorization": f"Bearer {res.json()['tokens']['access_token']}"
    }


async def _make_dog(client: AsyncClient, headers: dict, name: str = "InboxPup") -> str:
    res = await client.post("/api/v1/pets", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _inbox(client: AsyncClient, headers: dict) -> list[dict]:
    res = await client.get("/api/v1/notifications/inbox", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.asyncio
async def test_follow_notifies_owner(client: AsyncClient):
    _, owner_headers = await _make_user(client, "Owner")
    pet_id = await _make_dog(client, owner_headers, "Followed")
    _, fan_headers = await _make_user(client, "Fan")

    res = await client.post("/api/v1/social/follows", json={"pet_id": pet_id}, headers=fan_headers)
    assert res.status_code == 201

    inbox = await _inbox(client, owner_headers)
    assert any(n["type"] == "follow" and "Fan" in n["title"] for n in inbox)
    # The follower gets nothing about their own action.
    assert all(n["type"] != "follow" for n in await _inbox(client, fan_headers))


@pytest.mark.asyncio
async def test_comment_notifies_owner_and_respects_pref(client: AsyncClient):
    _, owner_headers = await _make_user(client, "Owner")
    pet_id = await _make_dog(client, owner_headers, "Commented")
    _, commenter_headers = await _make_user(client, "Chatty")

    res = await client.post("/api/v1/social/comments", json={
        "target_type": "pet", "target_id": pet_id, "body": "What a good pet!",
    }, headers=commenter_headers)
    assert res.status_code == 201

    inbox = await _inbox(client, owner_headers)
    entry = next(n for n in inbox if n["type"] == "comment")
    assert "Chatty" in entry["title"]
    assert entry["body"] == "What a good pet!"
    assert entry["link"] == f"/app/pets/{pet_id}"

    # Turn the preference off — further comments stay silent.
    await client.patch("/api/v1/notifications/preferences", json={
        "comments_on_dogs": False,
    }, headers=owner_headers)
    await client.post("/api/v1/social/comments", json={
        "target_type": "pet", "target_id": pet_id, "body": "Another comment",
    }, headers=commenter_headers)
    inbox = await _inbox(client, owner_headers)
    assert sum(1 for n in inbox if n["type"] == "comment") == 1


@pytest.mark.asyncio
async def test_own_comment_does_not_notify_self(client: AsyncClient):
    _, owner_headers = await _make_user(client, "Owner")
    pet_id = await _make_dog(client, owner_headers, "SelfTalk")
    await client.post("/api/v1/social/comments", json={
        "target_type": "pet", "target_id": pet_id, "body": "My own pet!",
    }, headers=owner_headers)
    assert all(n["type"] != "comment" for n in await _inbox(client, owner_headers))


@pytest.mark.asyncio
async def test_sighting_notifies_reporter(client: AsyncClient):
    _, reporter_headers = await _make_user(client, "Reporter")
    create = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "description": "Inbox sighting test",
    }, headers=reporter_headers)
    report_id = create.json()["id"]

    _, sighter_headers = await _make_user(client, "Sighter")
    res = await client.post(
        f"/api/v1/lost/reports/{report_id}/sightings",
        data={"lat": "37.78", "lng": "-122.41", "note": "Saw them by the park"},
        headers=sighter_headers,
    )
    assert res.status_code == 201, res.text

    inbox = await _inbox(client, reporter_headers)
    entry = next(n for n in inbox if n["type"] == "sighting")
    assert entry["link"] == f"/app/lost/{report_id}"
    assert entry["body"] == "Saw them by the park"


@pytest.mark.asyncio
async def test_unread_count_and_read_flow(client: AsyncClient):
    _, owner_headers = await _make_user(client, "Owner")
    pet_id = await _make_dog(client, owner_headers, "ReadFlow")
    _, fan_headers = await _make_user(client, "Fan")
    await client.post("/api/v1/social/follows", json={"pet_id": pet_id}, headers=fan_headers)
    await client.post("/api/v1/social/comments", json={
        "target_type": "pet", "target_id": pet_id, "body": "hi",
    }, headers=fan_headers)

    count = (await client.get("/api/v1/notifications/inbox/unread-count", headers=owner_headers)).json()
    assert count["count"] == 2

    inbox = await _inbox(client, owner_headers)
    first_id = inbox[0]["id"]
    marked = await client.post(
        f"/api/v1/notifications/inbox/{first_id}/read", headers=owner_headers
    )
    assert marked.status_code == 200
    assert marked.json()["read_at"] is not None

    count = (await client.get("/api/v1/notifications/inbox/unread-count", headers=owner_headers)).json()
    assert count["count"] == 1

    await client.post("/api/v1/notifications/inbox/read-all", headers=owner_headers)
    count = (await client.get("/api/v1/notifications/inbox/unread-count", headers=owner_headers)).json()
    assert count["count"] == 0


@pytest.mark.asyncio
async def test_cannot_read_someone_elses_notification(client: AsyncClient):
    _, owner_headers = await _make_user(client, "Owner")
    pet_id = await _make_dog(client, owner_headers, "Private")
    _, fan_headers = await _make_user(client, "Fan")
    await client.post("/api/v1/social/follows", json={"pet_id": pet_id}, headers=fan_headers)

    inbox = await _inbox(client, owner_headers)
    res = await client.post(
        f"/api/v1/notifications/inbox/{inbox[0]['id']}/read", headers=fan_headers
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_transfer_accept_notifies_sender(client: AsyncClient, admin_headers: dict):
    """Full loop: rescue transfers a pet, recipient gets an inbox entry, and
    accepting notifies the rescue back."""
    # Build an approved rescue with a pet.
    rescue_email = f"rescue-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup-rescue", json={
        "email": rescue_email, "password": "password123",
        "org_name": "Inbox Rescue", "description": "test rescue",
    })
    assert signup.status_code == 201, signup.text
    rescue_headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}
    profile_id = signup.json()["rescue_profile"]["id"]
    approve = await client.post(
        f"/api/v1/admin/rescue-profiles/{profile_id}/review",
        json={"approve": True}, headers=admin_headers,
    )
    assert approve.status_code == 200, approve.text
    pet_id = await _make_dog(client, rescue_headers, "TransferPup")

    adopter_id, adopter_headers = await _make_user(client, "Adopter")
    transfer = await client.post(
        f"/api/v1/rescues/pets/{pet_id}/transfer",
        json={"target_user_id": adopter_id}, headers=rescue_headers,
    )
    assert transfer.status_code in (200, 201), transfer.text
    transfer_id = transfer.json()["id"]

    inbox = await _inbox(client, adopter_headers)
    assert any(n["type"] == "transfer_received" for n in inbox)

    accept = await client.post(
        f"/api/v1/pet-transfers/{transfer_id}/accept", headers=adopter_headers
    )
    assert accept.status_code == 200, accept.text
    rescue_inbox = await _inbox(client, rescue_headers)
    assert any(
        n["type"] == "transfer_resolved" and "accepted" in n["title"]
        for n in rescue_inbox
    )
