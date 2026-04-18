import uuid

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_breeds_public(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/breeds", headers=auth_headers)
    assert res.status_code == 200
    items = res.json()
    assert len(items) > 0
    # Every item exposes id/name/slug
    for b in items:
        assert b["id"] and b["name"] and b["slug"]


@pytest.mark.asyncio
async def test_search_breeds(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/breeds", params={"q": "terr"}, headers=auth_headers)
    assert res.status_code == 200
    items = res.json()
    for b in items:
        assert "terr" in b["name"].lower()


@pytest.mark.asyncio
async def test_admin_breed_crud(client: AsyncClient, admin_headers: dict):
    suffix = uuid.uuid4().hex[:6]
    name = f"CRUD Breed {suffix}"
    # Create
    res = await client.post(
        "/api/v1/admin/breeds",
        json={"name": name, "group": "Custom"},
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text
    breed = res.json()
    breed_id = breed["id"]
    assert breed["slug"] == f"crud-breed-{suffix}"
    assert breed["dog_count"] == 0

    # Duplicate create should 409
    res = await client.post(
        "/api/v1/admin/breeds",
        json={"name": name},
        headers=admin_headers,
    )
    assert res.status_code == 409

    # Update
    res = await client.patch(
        f"/api/v1/admin/breeds/{breed_id}",
        json={"group": "Updated"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["group"] == "Updated"

    # Delete
    res = await client.delete(f"/api/v1/admin/breeds/{breed_id}", headers=admin_headers)
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_admin_delete_breed_with_dogs_blocked(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    # Create a new breed and attach a dog, then try to delete
    suffix = uuid.uuid4().hex[:6]
    res = await client.post(
        "/api/v1/admin/breeds",
        json={"name": f"Blocked Delete Breed {suffix}"},
        headers=admin_headers,
    )
    assert res.status_code == 201
    breed_id = res.json()["id"]

    res = await client.post(
        "/api/v1/dogs",
        json={"name": "UsesBreed", "mix_type": "purebred", "breed_ids": [breed_id]},
        headers=auth_headers,
    )
    assert res.status_code == 201

    res = await client.delete(f"/api/v1/admin/breeds/{breed_id}", headers=admin_headers)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_breeds_require_auth(client: AsyncClient):
    res = await client.get("/api/v1/breeds")
    assert res.status_code in (401, 403)
