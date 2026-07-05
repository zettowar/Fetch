"""Public share pages, member invites, liked list, dog stats, blocks, and
account (password/email change) endpoints."""
import uuid

import pytest
from httpx import AsyncClient

from app.config import settings


async def _make_user(client: AsyncClient, name: str = "Batch User") -> tuple[str, dict, str]:
    email = f"batch-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": name,
    })
    assert res.status_code == 201, res.text
    return res.json()["user"]["id"], {
        "Authorization": f"Bearer {res.json()['tokens']['access_token']}"
    }, email


async def _make_dog(client: AsyncClient, headers: dict, name: str = "BatchPup") -> str:
    res = await client.post("/api/v1/dogs", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


# --- Public share pages ---

@pytest.mark.asyncio
async def test_public_dog_page(client: AsyncClient):
    _, headers, _ = await _make_user(client, "Owner")
    dog_id = await _make_dog(client, headers, "ShareMe")

    res = await client.get(f"/api/v1/public/dogs/{dog_id}")  # no auth header
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "ShareMe"
    # The owner's identity never appears on the public page.
    assert "owner_id" not in body
    assert body["crown_weeks"] == []


@pytest.mark.asyncio
async def test_public_dog_respects_is_public_toggle(client: AsyncClient):
    _, headers, _ = await _make_user(client, "Owner")
    dog_id = await _make_dog(client, headers, "Hidden")

    off = await client.patch(
        f"/api/v1/dogs/{dog_id}", json={"is_public": False}, headers=headers
    )
    assert off.status_code == 200
    assert off.json()["is_public"] is False

    res = await client.get(f"/api/v1/public/dogs/{dog_id}")
    assert res.status_code == 404

    await client.patch(f"/api/v1/dogs/{dog_id}", json={"is_public": True}, headers=headers)
    assert (await client.get(f"/api/v1/public/dogs/{dog_id}")).status_code == 200


@pytest.mark.asyncio
async def test_public_top_dog(client: AsyncClient):
    from tests.conftest import test_session_factory
    from app.services.ranking_service import pick_current_winner

    _, owner_headers, _ = await _make_user(client, "Owner")
    dog_id = await _make_dog(client, owner_headers, "CrownPub")
    _, voter_headers, _ = await _make_user(client, "Voter")
    vote = await client.post("/api/v1/votes", json={"dog_id": dog_id, "value": 1}, headers=voter_headers)
    assert vote.status_code == 201

    async with test_session_factory() as db:
        await pick_current_winner(db)

    res = await client.get("/api/v1/public/top-dog")
    assert res.status_code == 200
    body = res.json()
    assert body is not None
    assert body["score"] >= 1


# --- Member invites ---

@pytest.mark.asyncio
async def test_member_invites_allowance_and_consumption(client: AsyncClient, monkeypatch):
    _, headers, _ = await _make_user(client, "Inviter")

    first = await client.post("/api/v1/invites/mine/generate", headers=headers)
    assert first.status_code == 201, first.text
    codes = first.json()
    assert len(codes) == settings.MEMBER_INVITE_ALLOWANCE

    # Allowance is lifetime — a second mint is refused.
    second = await client.post("/api/v1/invites/mine/generate", headers=headers)
    assert second.status_code == 400

    listing = await client.get("/api/v1/invites/mine", headers=headers)
    assert len(listing.json()) == settings.MEMBER_INVITE_ALLOWANCE

    # A friend can use one to get through the gate.
    monkeypatch.setattr(settings, "INVITE_REQUIRED", True)
    friend = await client.post("/api/v1/auth/signup", json={
        "email": f"friend-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123",
        "display_name": "Friend",
        "invite_code": codes[0]["code"],
    })
    assert friend.status_code == 201, friend.text
    monkeypatch.setattr(settings, "INVITE_REQUIRED", False)

    listing = await client.get("/api/v1/invites/mine", headers=headers)
    used = next(c for c in listing.json() if c["code"] == codes[0]["code"])
    assert used["is_used"] is True


# --- Liked dogs ---

@pytest.mark.asyncio
async def test_liked_dogs_list(client: AsyncClient):
    _, owner_headers, _ = await _make_user(client, "Owner")
    liked_id = await _make_dog(client, owner_headers, "LikedPup")
    passed_id = await _make_dog(client, owner_headers, "PassedPup")

    _, voter_headers, _ = await _make_user(client, "Voter")
    await client.post("/api/v1/votes", json={"dog_id": liked_id, "value": 1}, headers=voter_headers)
    await client.post("/api/v1/votes", json={"dog_id": passed_id, "value": -1}, headers=voter_headers)

    res = await client.get("/api/v1/votes/liked", headers=voter_headers)
    assert res.status_code == 200
    ids = [d["id"] for d in res.json()]
    assert liked_id in ids
    assert passed_id not in ids


# --- Dog stats (rank + crowns) ---

@pytest.mark.asyncio
async def test_dog_stats_rank_and_crowns(client: AsyncClient):
    _, owner_headers, _ = await _make_user(client, "Owner")
    dog_id = await _make_dog(client, owner_headers, "StatPup")
    _, voter_headers, _ = await _make_user(client, "Voter")
    await client.post("/api/v1/votes", json={"dog_id": dog_id, "value": 1}, headers=voter_headers)

    res = await client.get(f"/api/v1/rankings/dogs/{dog_id}/stats", headers=owner_headers)
    assert res.status_code == 200
    stats = res.json()
    assert stats["likes"] == 1
    assert stats["week_score"] == 1
    assert stats["week_rank"] >= 1
    assert stats["week_total"] >= 1
    assert isinstance(stats["crown_weeks"], list)


# --- Blocks ---

@pytest.mark.asyncio
async def test_block_enforcement(client: AsyncClient):
    blocker_id, blocker_headers, _ = await _make_user(client, "Blocker")
    blocker_dog = await _make_dog(client, blocker_headers, "GuardedPup")
    blocked_id, blocked_headers, _ = await _make_user(client, "Nuisance")
    blocked_dog = await _make_dog(client, blocked_headers, "NuisancePup")

    # Pre-block: the nuisance follows the blocker's dog.
    follow = await client.post(
        "/api/v1/social/follows", json={"dog_id": blocker_dog}, headers=blocked_headers
    )
    assert follow.status_code == 201

    res = await client.post(f"/api/v1/users/{blocked_id}/block", headers=blocker_headers)
    assert res.status_code == 201

    # The follow was severed.
    follows = await client.get("/api/v1/social/follows/mine", headers=blocked_headers)
    assert all(f["dog_id"] != blocker_dog for f in follows.json())

    # Neither commenting nor re-following works, and the block isn't disclosed.
    comment = await client.post("/api/v1/social/comments", json={
        "target_type": "dog", "target_id": blocker_dog, "body": "hi",
    }, headers=blocked_headers)
    assert comment.status_code == 404
    refollow = await client.post(
        "/api/v1/social/follows", json={"dog_id": blocker_dog}, headers=blocked_headers
    )
    assert refollow.status_code == 404

    # The blocker's feed never serves the blocked user's dog.
    feed = await client.get("/api/v1/feed/next", headers=blocker_headers)
    assert feed.status_code == 200
    assert all(d["id"] != blocked_dog for d in feed.json())

    # Visible in the block list; unblock restores commenting.
    blocks = await client.get("/api/v1/users/me/blocks", headers=blocker_headers)
    assert any(b["user_id"] == blocked_id for b in blocks.json())
    await client.delete(f"/api/v1/users/{blocked_id}/block", headers=blocker_headers)
    comment = await client.post("/api/v1/social/comments", json={
        "target_type": "dog", "target_id": blocker_dog, "body": "sorry",
    }, headers=blocked_headers)
    assert comment.status_code == 201


@pytest.mark.asyncio
async def test_cannot_block_self(client: AsyncClient):
    user_id, headers, _ = await _make_user(client, "Solo")
    res = await client.post(f"/api/v1/users/{user_id}/block", headers=headers)
    assert res.status_code == 400


# --- Account basics ---

@pytest.mark.asyncio
async def test_change_password_flow(client: AsyncClient):
    _, headers, email = await _make_user(client, "Changer")

    wrong = await client.post("/api/v1/auth/change-password", json={
        "current_password": "not-my-password", "new_password": "newpassword456",
    }, headers=headers)
    assert wrong.status_code == 400

    ok = await client.post("/api/v1/auth/change-password", json={
        "current_password": "password123", "new_password": "newpassword456",
    }, headers=headers)
    assert ok.status_code == 200, ok.text
    new_tokens = ok.json()

    # New credentials work; the returned refresh token is live.
    login = await client.post("/api/v1/auth/login", json={
        "email": email, "password": "newpassword456",
    })
    assert login.status_code == 200
    refreshed = await client.post("/api/v1/auth/refresh", json={
        "refresh_token": new_tokens["refresh_token"],
    })
    assert refreshed.status_code == 200


@pytest.mark.asyncio
async def test_change_email_flow(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "DEBUG_VERIFY_TOKEN", True)
    _, headers, old_email = await _make_user(client, "Mover")
    new_email = f"moved-{uuid.uuid4().hex[:8]}@fetchapp.dev"

    started = await client.post("/api/v1/auth/change-email", json={
        "password": "password123", "new_email": new_email,
    }, headers=headers)
    assert started.status_code == 200, started.text
    token = started.json()["debug_token"]

    confirmed = await client.post("/api/v1/auth/confirm-email-change", json={"token": token})
    assert confirmed.status_code == 200, confirmed.text

    # New email logs in; the account is now verified; old email is free.
    login = await client.post("/api/v1/auth/login", json={
        "email": new_email, "password": "password123",
    })
    assert login.status_code == 200
    assert login.json()["user"]["is_verified"] is True
    old_login = await client.post("/api/v1/auth/login", json={
        "email": old_email, "password": "password123",
    })
    assert old_login.status_code == 401


@pytest.mark.asyncio
async def test_change_email_rejects_taken_address(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(settings, "DEBUG_VERIFY_TOKEN", True)
    _, _, other_email = await _make_user(client, "Other")
    _, headers, _ = await _make_user(client, "Taker")

    res = await client.post("/api/v1/auth/change-email", json={
        "password": "password123", "new_email": other_email,
    }, headers=headers)
    assert res.status_code == 409
