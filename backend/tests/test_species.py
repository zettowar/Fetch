"""Species (cat/dog) parity: create, breed-species matching, and filtering."""
import uuid

import pytest
from httpx import AsyncClient

from app.models.breed import Breed


async def _mk_breeds() -> tuple[str, str, str, str]:
    """Insert a fresh dog breed and cat breed; return (dog_id, cat_id, dog_name, cat_name)."""
    from tests.conftest import test_session_factory

    tag = uuid.uuid4().hex[:6]
    dog_b = Breed(id=uuid.uuid4(), name=f"TestDog {tag}", slug=f"testdog-{tag}", species="dog")
    cat_b = Breed(id=uuid.uuid4(), name=f"TestCat {tag}", slug=f"testcat-{tag}", species="cat")
    async with test_session_factory() as db:
        db.add_all([dog_b, cat_b])
        await db.commit()
        return str(dog_b.id), str(cat_b.id), dog_b.name, cat_b.name


@pytest.mark.asyncio
async def test_create_cat_roundtrips_species(client: AsyncClient, auth_headers: dict):
    r = await client.post(
        "/api/v1/pets", json={"name": "Whiskers", "species": "cat"}, headers=auth_headers
    )
    assert r.status_code == 201, r.text
    assert r.json()["species"] == "cat"


@pytest.mark.asyncio
async def test_species_defaults_to_dog(client: AsyncClient, auth_headers: dict):
    r = await client.post("/api/v1/pets", json={"name": "Rex"}, headers=auth_headers)
    assert r.status_code == 201, r.text
    assert r.json()["species"] == "dog"


@pytest.mark.asyncio
async def test_invalid_species_rejected(client: AsyncClient, auth_headers: dict):
    r = await client.post(
        "/api/v1/pets", json={"name": "Nessie", "species": "dragon"}, headers=auth_headers
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_pet_breeds_must_match_species(client: AsyncClient, auth_headers: dict):
    dog_id, cat_id, _, _ = await _mk_breeds()

    # A cat tagged with a cat breed: allowed.
    ok = await client.post(
        "/api/v1/pets",
        json={"name": "Cleo", "species": "cat", "mix_type": "purebred", "breed_ids": [cat_id]},
        headers=auth_headers,
    )
    assert ok.status_code == 201, ok.text

    # A cat tagged with a DOG breed: rejected (can't tag a cat a Labrador).
    bad = await client.post(
        "/api/v1/pets",
        json={"name": "Impostor", "species": "cat", "mix_type": "purebred", "breed_ids": [dog_id]},
        headers=auth_headers,
    )
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_breeds_filtered_by_species(client: AsyncClient, auth_headers: dict):
    dog_id, cat_id, dog_name, cat_name = await _mk_breeds()

    r = await client.get(
        "/api/v1/breeds", params={"species": "cat"}, headers=auth_headers
    )
    assert r.status_code == 200
    returned = r.json()
    names = {b["name"] for b in returned}
    assert cat_name in names
    assert dog_name not in names
    assert all(b["species"] == "cat" for b in returned)


@pytest.mark.asyncio
async def test_explore_filters_by_species(client: AsyncClient):
    # An owner with one dog and one cat.
    owner = await client.post("/api/v1/auth/signup", json={
        "email": f"o-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123", "display_name": "Owner",
    })
    oh = {"Authorization": f"Bearer {owner.json()['tokens']['access_token']}"}
    await client.post("/api/v1/pets", json={"name": "Rex", "species": "dog"}, headers=oh)
    await client.post("/api/v1/pets", json={"name": "Felix", "species": "cat"}, headers=oh)

    # A different viewer explores cats only — must never see a dog.
    viewer = await client.post("/api/v1/auth/signup", json={
        "email": f"v-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123", "display_name": "Viewer",
    })
    vh = {"Authorization": f"Bearer {viewer.json()['tokens']['access_token']}"}
    r = await client.get("/api/v1/pets/explore", params={"species": "cat"}, headers=vh)
    assert r.status_code == 200
    assert all(p["species"] == "cat" for p in r.json())
