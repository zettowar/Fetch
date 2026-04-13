import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_dog(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/dogs", json={
        "name": "Buddy",
        "breed": "Golden Retriever",
        "bio": "Good boy",
    }, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Buddy"
    assert data["breed"] == "Golden Retriever"


@pytest.mark.asyncio
async def test_list_my_dogs(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/dogs", json={"name": "Dog1"}, headers=auth_headers)
    await client.post("/api/v1/dogs", json={"name": "Dog2"}, headers=auth_headers)
    res = await client.get("/api/v1/dogs/mine", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 2


@pytest.mark.asyncio
async def test_get_dog(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/dogs", json={"name": "Viewable"}, headers=auth_headers)
    dog_id = create_res.json()["id"]
    res = await client.get(f"/api/v1/dogs/{dog_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Viewable"


@pytest.mark.asyncio
async def test_update_dog(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/dogs", json={"name": "OldName"}, headers=auth_headers)
    dog_id = create_res.json()["id"]
    res = await client.patch(f"/api/v1/dogs/{dog_id}", json={"name": "NewName"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "NewName"


@pytest.mark.asyncio
async def test_delete_dog(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/dogs", json={"name": "ToDelete"}, headers=auth_headers)
    dog_id = create_res.json()["id"]
    res = await client.delete(f"/api/v1/dogs/{dog_id}", headers=auth_headers)
    assert res.status_code == 200

    # Should not appear in list anymore
    get_res = await client.get(f"/api/v1/dogs/{dog_id}", headers=auth_headers)
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_dog_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/dogs", json={"name": "NoAuth"})
    assert res.status_code in (401, 403)
