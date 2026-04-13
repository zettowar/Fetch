"""Tests for the users router — profile update and account deactivation."""
import uuid

import pytest
from httpx import AsyncClient


async def _fresh_user(client: AsyncClient) -> dict:
    """Sign up and return auth headers."""
    email = f"users-test-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "testpass123",
        "display_name": "User Test",
    })
    assert res.status_code == 201
    token = res.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/users/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "id" in data
    assert "email" in data
    assert "display_name" in data


@pytest.mark.asyncio
async def test_get_me_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/users/me")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_update_display_name(client: AsyncClient, auth_headers: dict):
    res = await client.patch("/api/v1/users/me", json={"display_name": "New Name"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["display_name"] == "New Name"


@pytest.mark.asyncio
async def test_update_location(client: AsyncClient, auth_headers: dict):
    res = await client.patch("/api/v1/users/me", json={"location_rough": "Chicago, IL"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["location_rough"] == "Chicago, IL"


@pytest.mark.asyncio
async def test_update_date_of_birth(client: AsyncClient, auth_headers: dict):
    res = await client.patch("/api/v1/users/me", json={"date_of_birth": "1995-06-15"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["date_of_birth"] == "1995-06-15"


@pytest.mark.asyncio
async def test_delete_account_deactivates_user(client: AsyncClient):
    headers = await _fresh_user(client)
    res = await client.delete("/api/v1/users/me", headers=headers)
    assert res.status_code == 200
    assert "deactivated" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_account_deactivates_dogs(client: AsyncClient, auth_headers: dict):
    """Deleting an account also deactivates their dogs (inactive dogs return 404 to others)."""
    headers = await _fresh_user(client)

    # Create a dog under the fresh user
    dog_res = await client.post("/api/v1/dogs", json={"name": "Doomed Dog"}, headers=headers)
    assert dog_res.status_code == 201
    dog_id = dog_res.json()["id"]

    # Delete the fresh user's account
    del_res = await client.delete("/api/v1/users/me", headers=headers)
    assert del_res.status_code == 200

    # A different authenticated user should now get 404 for the inactive dog
    get_res = await client.get(f"/api/v1/dogs/{dog_id}", headers=auth_headers)
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_partial_update_unchanged_fields(client: AsyncClient, auth_headers: dict):
    """PATCH only updates provided fields; others remain unchanged."""
    # Set display name
    await client.patch("/api/v1/users/me", json={"display_name": "OriginalName"}, headers=auth_headers)
    # Update only location
    res = await client.patch("/api/v1/users/me", json={"location_rough": "Portland, OR"}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["location_rough"] == "Portland, OR"
    assert data["display_name"] == "OriginalName"
