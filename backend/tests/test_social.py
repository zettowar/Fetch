import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_follow_pet(client: AsyncClient, auth_headers: dict):
    # Create a pet to follow (as another user)
    email = f"dogowner-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Owner"
    })
    owner_headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}
    pet_res = await client.post("/api/v1/pets", json={"name": "FollowMe"}, headers=owner_headers)
    pet_id = pet_res.json()["id"]

    # Follow
    res = await client.post("/api/v1/social/follows", json={"pet_id": pet_id}, headers=auth_headers)
    assert res.status_code == 201

    # Duplicate follow
    res2 = await client.post("/api/v1/social/follows", json={"pet_id": pet_id}, headers=auth_headers)
    assert res2.status_code == 409


@pytest.mark.asyncio
async def test_unfollow_pet(client: AsyncClient, auth_headers: dict):
    email = f"unfollowowner-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Owner2"
    })
    owner_headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}
    pet_res = await client.post("/api/v1/pets", json={"name": "UnfollowMe"}, headers=owner_headers)
    pet_id = pet_res.json()["id"]

    await client.post("/api/v1/social/follows", json={"pet_id": pet_id}, headers=auth_headers)
    res = await client.delete(f"/api/v1/social/follows/{pet_id}", headers=auth_headers)
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_my_follows_returns_hydrated_dogs(client: AsyncClient, auth_headers: dict):
    """Regression: my_follows must eager-load pet.breeds and pet.owner.rescue_profile
    so _pet_to_out serialization doesn't lazy-trigger in async context."""
    # Create a purebred pet (with breeds) as another user
    email = f"followowner-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "FollowOwner"
    })
    owner_headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}
    breeds = (await client.get("/api/v1/breeds", headers=owner_headers)).json()
    pet_res = await client.post("/api/v1/pets", json={
        "name": "HydratedPup",
        "mix_type": "purebred",
        "breed_ids": [breeds[0]["id"]],
    }, headers=owner_headers)
    pet_id = pet_res.json()["id"]

    # Follow and then list
    await client.post("/api/v1/social/follows", json={"pet_id": pet_id}, headers=auth_headers)
    res = await client.get("/api/v1/social/follows/mine", headers=auth_headers)
    assert res.status_code == 200, res.text
    follows = res.json()
    assert any(f["pet_id"] == pet_id for f in follows)
    # The pet payload should be fully hydrated (breed_display requires breeds).
    hydrated = next(f for f in follows if f["pet_id"] == pet_id)
    assert hydrated["pet"] is not None
    assert hydrated["pet"]["breed_display"]


@pytest.mark.asyncio
async def test_follower_count(client: AsyncClient, auth_headers: dict):
    email = f"countowner-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "CountOwner"
    })
    owner_headers = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}
    pet_res = await client.post("/api/v1/pets", json={"name": "CountDog"}, headers=owner_headers)
    pet_id = pet_res.json()["id"]

    await client.post("/api/v1/social/follows", json={"pet_id": pet_id}, headers=auth_headers)

    res = await client.get(f"/api/v1/social/pets/{pet_id}/followers/count", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["count"] >= 1
    assert res.json()["is_following"] is True


@pytest.mark.asyncio
async def test_create_comment(client: AsyncClient, auth_headers: dict):
    pet_res = await client.post("/api/v1/pets", json={"name": "CommentDog"}, headers=auth_headers)
    pet_id = pet_res.json()["id"]

    res = await client.post("/api/v1/social/comments", json={
        "target_type": "pet",
        "target_id": pet_id,
        "body": "What a good pet!",
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["body"] == "What a good pet!"


@pytest.mark.asyncio
async def test_list_comments(client: AsyncClient, auth_headers: dict):
    pet_res = await client.post("/api/v1/pets", json={"name": "ListCommentDog"}, headers=auth_headers)
    pet_id = pet_res.json()["id"]

    await client.post("/api/v1/social/comments", json={
        "target_type": "pet", "target_id": pet_id, "body": "Comment 1"
    }, headers=auth_headers)

    res = await client.get("/api/v1/social/comments", params={
        "target_type": "pet", "target_id": pet_id
    }, headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_toggle_reaction(client: AsyncClient, auth_headers: dict):
    pet_res = await client.post("/api/v1/pets", json={"name": "ReactDog"}, headers=auth_headers)
    pet_id = pet_res.json()["id"]

    # React
    res = await client.post("/api/v1/social/reactions", json={
        "target_type": "pet", "target_id": pet_id, "kind": "cute"
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["cute"] >= 1
    assert res.json()["user_reaction"] == "cute"

    # Toggle off (same kind)
    res2 = await client.post("/api/v1/social/reactions", json={
        "target_type": "pet", "target_id": pet_id, "kind": "cute"
    }, headers=auth_headers)
    assert res2.json()["user_reaction"] is None


@pytest.mark.asyncio
async def test_user_profile(client: AsyncClient, auth_headers: dict):
    me_res = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me_res.json()["id"]

    res = await client.get(f"/api/v1/social/users/{user_id}/profile", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == user_id
    assert "pet_count" in res.json()
    assert "follower_count" in res.json()


@pytest.mark.asyncio
async def test_social_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/social/follows/mine")
    assert res.status_code in (401, 403)
