"""Tests for the votes router — the core gameplay mechanic."""
import uuid

import pytest
from httpx import AsyncClient


async def _create_user_and_dog(client: AsyncClient, suffix: str = "") -> tuple[dict, str]:
    """Helper: sign up a fresh user and create a dog. Returns (auth_headers, dog_id)."""
    email = f"vote-test-{uuid.uuid4().hex[:8]}{suffix}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "testpass123",
        "display_name": f"Voter {suffix}",
    })
    assert res.status_code == 201
    token = res.json()["tokens"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    dog_res = await client.post("/api/v1/dogs", json={"name": f"Dog-{suffix}"}, headers=headers)
    assert dog_res.status_code == 201
    dog_id = dog_res.json()["id"]
    return headers, dog_id


@pytest.mark.asyncio
async def test_cast_vote(client: AsyncClient, auth_headers: dict):
    """A user can vote on another user's dog."""
    _, target_dog_id = await _create_user_and_dog(client, "target1")

    res = await client.post("/api/v1/votes", json={"dog_id": target_dog_id, "value": 1}, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["dog_id"] == target_dog_id
    assert data["value"] == 1


@pytest.mark.asyncio
async def test_cannot_vote_own_dog(client: AsyncClient):
    """A user cannot vote on their own dog."""
    headers, own_dog_id = await _create_user_and_dog(client, "self-vote")

    res = await client.post("/api/v1/votes", json={"dog_id": own_dog_id, "value": 1}, headers=headers)
    assert res.status_code == 400
    assert "own dog" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_duplicate_vote_rejected(client: AsyncClient, auth_headers: dict):
    """Voting twice on the same dog in the same week returns 409."""
    _, target_dog_id = await _create_user_and_dog(client, "target2")

    res1 = await client.post("/api/v1/votes", json={"dog_id": target_dog_id, "value": 1}, headers=auth_headers)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/votes", json={"dog_id": target_dog_id, "value": 1}, headers=auth_headers)
    assert res2.status_code == 409


@pytest.mark.asyncio
async def test_vote_nonexistent_dog(client: AsyncClient, auth_headers: dict):
    """Voting on a non-existent dog returns 404."""
    fake_id = str(uuid.uuid4())
    res = await client.post("/api/v1/votes", json={"dog_id": fake_id, "value": 1}, headers=auth_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_vote_requires_auth(client: AsyncClient):
    """Unauthenticated vote returns 401/403."""
    res = await client.post("/api/v1/votes", json={"dog_id": str(uuid.uuid4()), "value": 1})
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_my_votes_empty_initially(client: AsyncClient):
    """A new user has no votes this week."""
    headers, _ = await _create_user_and_dog(client, "novotes")
    res = await client.get("/api/v1/votes/mine", headers=headers)
    assert res.status_code == 200
    assert res.json() == []


@pytest.mark.asyncio
async def test_my_votes_returns_cast_votes(client: AsyncClient, auth_headers: dict):
    """my_votes returns votes cast by the current user this week."""
    _, dog_id = await _create_user_and_dog(client, "target3")

    await client.post("/api/v1/votes", json={"dog_id": dog_id, "value": 1}, headers=auth_headers)

    res = await client.get("/api/v1/votes/mine", headers=auth_headers)
    assert res.status_code == 200
    dog_ids = [v["dog_id"] for v in res.json()]
    assert dog_id in dog_ids


@pytest.mark.asyncio
async def test_downvote_allowed(client: AsyncClient, auth_headers: dict):
    """Negative vote values are accepted."""
    _, dog_id = await _create_user_and_dog(client, "downvote")
    res = await client.post("/api/v1/votes", json={"dog_id": dog_id, "value": -1}, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["value"] == -1
