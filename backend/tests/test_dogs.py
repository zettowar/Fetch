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
    res = await client.post("/api/v1/pets", json={
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
    res = await client.post("/api/v1/pets", json={"name": "NoBreed"}, headers=auth_headers)
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
    res = await client.post("/api/v1/pets", json={
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
async def test_update_pet_breeds(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/pets", json={"name": "Flexi"}, headers=auth_headers)
    pet_id = create_res.json()["id"]

    res = await client.get("/api/v1/breeds", headers=auth_headers)
    ids = [b["id"] for b in res.json()[:2]]

    res = await client.patch(
        f"/api/v1/pets/{pet_id}",
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
        f"/api/v1/pets/{pet_id}",
        json={"mix_type": "mystery_mutt", "breed_ids": []},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["breed_display"] == "Mystery mutt"


@pytest.mark.asyncio
async def test_reject_invalid_mix_type(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/api/v1/pets",
        json={"name": "Bad", "mix_type": "banana"},
        headers=auth_headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_reject_too_many_breeds(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/breeds", headers=auth_headers)
    ids = [b["id"] for b in res.json()[:4]]
    res = await client.post(
        "/api/v1/pets",
        json={"name": "Many", "mix_type": "mixed", "breed_ids": ids},
        headers=auth_headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_reject_unknown_breed_id(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/api/v1/pets",
        json={
            "name": "Ghost",
            "mix_type": "purebred",
            "breed_ids": ["00000000-0000-0000-0000-000000000000"],
        },
        headers=auth_headers,
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_list_my_pets(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/pets", json={"name": "Dog1"}, headers=auth_headers)
    await client.post("/api/v1/pets", json={"name": "Dog2"}, headers=auth_headers)
    res = await client.get("/api/v1/pets/mine", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 2


@pytest.mark.asyncio
async def test_get_pet(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/pets", json={"name": "Viewable"}, headers=auth_headers)
    pet_id = create_res.json()["id"]
    res = await client.get(f"/api/v1/pets/{pet_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Viewable"


@pytest.mark.asyncio
async def test_update_pet(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/pets", json={"name": "OldName"}, headers=auth_headers)
    pet_id = create_res.json()["id"]
    res = await client.patch(f"/api/v1/pets/{pet_id}", json={"name": "NewName"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "NewName"


@pytest.mark.asyncio
async def test_delete_pet(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/pets", json={"name": "ToDelete"}, headers=auth_headers)
    pet_id = create_res.json()["id"]
    res = await client.delete(f"/api/v1/pets/{pet_id}", headers=auth_headers)
    assert res.status_code == 200

    get_res = await client.get(f"/api/v1/pets/{pet_id}", headers=auth_headers)
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_dog_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/pets", json={"name": "NoAuth"})
    assert res.status_code in (401, 403)


# --- Primary photo ---


def _tiny_jpeg() -> bytes:
    import io
    from PIL import Image
    img = Image.new("RGB", (40, 40), color="blue")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_set_primary_photo_happy_path(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/v1/pets", json={"name": "Primary"}, headers=auth_headers)
    pet_id = create.json()["id"]
    upload = await client.post(
        f"/api/v1/pets/{pet_id}/photos",
        files={"file": ("p.jpg", _tiny_jpeg(), "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload.json()["id"]

    res = await client.post(
        f"/api/v1/pets/{pet_id}/primary-photo",
        json={"photo_id": photo_id},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["primary_photo_id"] == photo_id


@pytest.mark.asyncio
async def test_set_primary_photo_rejects_unrelated_photo(
    client: AsyncClient, auth_headers: dict
):
    # Two pets, photo on pet A, attempt to set as primary on pet B.
    a = await client.post("/api/v1/pets", json={"name": "DogA"}, headers=auth_headers)
    b = await client.post("/api/v1/pets", json={"name": "DogB"}, headers=auth_headers)
    dog_a_id, dog_b_id = a.json()["id"], b.json()["id"]
    upload = await client.post(
        f"/api/v1/pets/{dog_a_id}/photos",
        files={"file": ("p.jpg", _tiny_jpeg(), "image/jpeg")},
        headers=auth_headers,
    )
    foreign_photo_id = upload.json()["id"]

    res = await client.post(
        f"/api/v1/pets/{dog_b_id}/primary-photo",
        json={"photo_id": foreign_photo_id},
        headers=auth_headers,
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_set_primary_photo_requires_owner(client: AsyncClient, auth_headers: dict):
    import uuid
    create = await client.post("/api/v1/pets", json={"name": "Owned"}, headers=auth_headers)
    pet_id = create.json()["id"]
    upload = await client.post(
        f"/api/v1/pets/{pet_id}/photos",
        files={"file": ("p.jpg", _tiny_jpeg(), "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload.json()["id"]

    # Different user.
    email = f"interloper-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    s = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Interloper",
    })
    other_headers = {"Authorization": f"Bearer {s.json()['tokens']['access_token']}"}

    res = await client.post(
        f"/api/v1/pets/{pet_id}/primary-photo",
        json={"photo_id": photo_id},
        headers=other_headers,
    )
    assert res.status_code == 403
