import pytest
from httpx import AsyncClient


async def _first_breed_id(client: AsyncClient, auth_headers: dict) -> str:
    res = await client.get("/api/v1/breeds", headers=auth_headers)
    assert res.status_code == 200
    items = res.json()
    assert items, "Breeds fixture did not seed any breeds"
    return items[0]["id"]


@pytest.mark.asyncio
async def test_create_dog_purebred(client: AsyncClient, auth_headers: dict):
    breed_id = await _first_breed_id(client, auth_headers)
    res = await client.post("/api/v1/dogs", json={
        "name": "Buddy",
        "mix_type": "purebred",
        "breed_ids": [breed_id],
        "bio": "Good boy",
    }, headers=auth_headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["name"] == "Buddy"
    assert data["mix_type"] == "purebred"
    assert len(data["breeds"]) == 1
    assert data["breeds"][0]["id"] == breed_id
    assert data["breed_display"] == data["breeds"][0]["name"]


@pytest.mark.asyncio
async def test_create_dog_mystery_mutt(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/dogs", json={"name": "NoBreed"}, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["mix_type"] == "mystery_mutt"
    assert data["breeds"] == []
    assert data["breed_display"] == "Mystery mutt"


@pytest.mark.asyncio
async def test_create_dog_cross(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/breeds", headers=auth_headers)
    ids = [b["id"] for b in res.json()[:2]]
    assert len(ids) == 2
    res = await client.post("/api/v1/dogs", json={
        "name": "Crosspup",
        "mix_type": "cross",
        "breed_ids": ids,
    }, headers=auth_headers)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["mix_type"] == "cross"
    assert len(data["breeds"]) == 2
    assert " × " in data["breed_display"]


@pytest.mark.asyncio
async def test_update_dog_breeds(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/dogs", json={"name": "Flexi"}, headers=auth_headers)
    dog_id = create_res.json()["id"]

    res = await client.get("/api/v1/breeds", headers=auth_headers)
    ids = [b["id"] for b in res.json()[:2]]

    res = await client.patch(
        f"/api/v1/dogs/{dog_id}",
        json={"mix_type": "mixed", "breed_ids": ids},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["mix_type"] == "mixed"
    assert len(data["breeds"]) == 2
    assert data["breed_display"].endswith("mix")

    # Clearing to mystery_mutt
    res = await client.patch(
        f"/api/v1/dogs/{dog_id}",
        json={"mix_type": "mystery_mutt", "breed_ids": []},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["breed_display"] == "Mystery mutt"


@pytest.mark.asyncio
async def test_reject_invalid_mix_type(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/api/v1/dogs",
        json={"name": "Bad", "mix_type": "banana"},
        headers=auth_headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_reject_too_many_breeds(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/breeds", headers=auth_headers)
    ids = [b["id"] for b in res.json()[:4]]
    res = await client.post(
        "/api/v1/dogs",
        json={"name": "Many", "mix_type": "mixed", "breed_ids": ids},
        headers=auth_headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_reject_unknown_breed_id(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/api/v1/dogs",
        json={
            "name": "Ghost",
            "mix_type": "purebred",
            "breed_ids": ["00000000-0000-0000-0000-000000000000"],
        },
        headers=auth_headers,
    )
    assert res.status_code == 400


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

    get_res = await client.get(f"/api/v1/dogs/{dog_id}", headers=auth_headers)
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_dog_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/dogs", json={"name": "NoAuth"})
    assert res.status_code in (401, 403)
