"""Free-form personality traits and the admin vocabulary behind them.

Owners can type any trait they like; an unknown one creates a `pending` row in
`pet_traits` that an admin promotes into the suggestion chips (or rejects).
Because pets store trait *labels*, not FKs, the interesting cases are the ones
where editing the vocabulary has to rewrite `pets.traits` too.
"""

import uuid

import pytest
from httpx import AsyncClient

from app.services.traits import MAX_TRAITS_PER_PET, normalize_trait


async def _create_pet(client: AsyncClient, headers: dict, **kwargs):
    body = {"name": f"Trait Dog {uuid.uuid4().hex[:6]}", "species": "dog", **kwargs}
    res = await client.post("/api/v1/pets", json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


async def _find_trait(client: AsyncClient, admin_headers: dict, slug: str) -> dict | None:
    res = await client.get("/api/v1/admin/pet-traits?limit=200", headers=admin_headers)
    assert res.status_code == 200, res.text
    return next((t for t in res.json() if t["slug"] == slug), None)


# --- normalization -----------------------------------------------------------

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("  good   with kids ", "Good with kids"),
        ("ball-obsessed", "Ball-obsessed"),
        ("LOUD", "LOUD"),  # only the first character is forced
        ("café lover", "Café lover"),
    ],
)
def test_normalize_trait_cleans_input(raw, expected):
    assert normalize_trait(raw) == expected


@pytest.mark.parametrize("raw", ["", "   ", "!!!", "http://spam.example", "loves 🐕", "a" * 31])
def test_normalize_trait_rejects_junk(raw):
    with pytest.raises(ValueError):
        normalize_trait(raw)


# --- owner-facing behaviour --------------------------------------------------

@pytest.mark.asyncio
async def test_unknown_trait_is_accepted_and_queued(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    pet = await _create_pet(client, auth_headers, traits=["sock  THIEF"])
    # Whitespace collapsed, first letter capitalized, and it lands on the pet.
    assert pet["traits"] == ["Sock THIEF"]

    queued = await _find_trait(client, admin_headers, "sock-thief")
    assert queued is not None
    assert queued["status"] == "pending"
    assert queued["pet_count"] == 1
    assert queued["created_by_name"] == "Test User"


@pytest.mark.asyncio
async def test_trait_variants_collapse_onto_the_canonical_spelling(
    client: AsyncClient, auth_headers: dict
):
    first = await _create_pet(client, auth_headers, traits=["Velcro dog"])
    assert first["traits"] == ["Velcro dog"]

    # A different owner types it differently — same trait, canonical spelling,
    # and the duplicate within one request collapses too.
    second = await _create_pet(client, auth_headers, traits=["velcro DOG", "VELCRO dog"])
    assert second["traits"] == ["Velcro dog"]


@pytest.mark.asyncio
async def test_trait_shape_is_validated(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/api/v1/pets",
        json={"name": "Bad", "species": "dog", "traits": ["http://spam.example"]},
        headers=auth_headers,
    )
    assert res.status_code == 422

    res = await client.post(
        "/api/v1/pets",
        json={
            "name": "Too many",
            "species": "dog",
            "traits": [f"trait {i}" for i in range(MAX_TRAITS_PER_PET + 1)],
        },
        headers=auth_headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_trait_options_are_species_scoped(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    await client.post(
        "/api/v1/admin/pet-traits",
        json={"label": "Fetch fiend", "species": "dog"},
        headers=admin_headers,
    )
    await client.post(
        "/api/v1/admin/pet-traits",
        json={"label": "Windowsill napper", "species": "cat"},
        headers=admin_headers,
    )
    await client.post(
        "/api/v1/admin/pet-traits",
        json={"label": "Snuggly", "species": "both"},
        headers=admin_headers,
    )

    dog = await client.get("/api/v1/pets/traits?species=dog", headers=auth_headers)
    labels = [t["label"] for t in dog.json()]
    assert "Fetch fiend" in labels
    assert "Snuggly" in labels
    assert "Windowsill napper" not in labels

    cat = await client.get("/api/v1/pets/traits?species=cat", headers=auth_headers)
    labels = [t["label"] for t in cat.json()]
    assert "Windowsill napper" in labels
    assert "Snuggly" in labels
    assert "Fetch fiend" not in labels


@pytest.mark.asyncio
async def test_pending_traits_are_not_suggested(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    await _create_pet(client, auth_headers, traits=["Mud enthusiast"])
    res = await client.get("/api/v1/pets/traits?species=dog", headers=auth_headers)
    assert "Mud enthusiast" not in [t["label"] for t in res.json()]

    trait = await _find_trait(client, admin_headers, "mud-enthusiast")
    await client.patch(
        f"/api/v1/admin/pet-traits/{trait['id']}",
        json={"status": "approved", "species": "dog"},
        headers=admin_headers,
    )

    res = await client.get("/api/v1/pets/traits?species=dog", headers=auth_headers)
    assert "Mud enthusiast" in [t["label"] for t in res.json()]


# --- admin vocabulary management ---------------------------------------------

@pytest.mark.asyncio
async def test_rename_propagates_to_pets(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    pet = await _create_pet(client, auth_headers, traits=["Zoomie machine"])
    trait = await _find_trait(client, admin_headers, "zoomie-machine")

    res = await client.patch(
        f"/api/v1/admin/pet-traits/{trait['id']}",
        json={"label": "Zoomies", "status": "approved"},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["label"] == "Zoomies"

    # The pet must follow the rename, or it keeps a label the vocabulary no
    # longer knows about.
    res = await client.get(f"/api/v1/pets/{pet['id']}", headers=auth_headers)
    assert res.json()["traits"] == ["Zoomies"]


@pytest.mark.asyncio
async def test_rejecting_strips_the_trait_and_blocks_re_adding(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    pet = await _create_pet(client, auth_headers, traits=["Bitey"])
    trait = await _find_trait(client, admin_headers, "bitey")

    res = await client.patch(
        f"/api/v1/admin/pet-traits/{trait['id']}",
        json={"status": "rejected"},
        headers=admin_headers,
    )
    assert res.status_code == 200, res.text

    res = await client.get(f"/api/v1/pets/{pet['id']}", headers=auth_headers)
    assert res.json()["traits"] == []

    # The tombstone stops the next owner from re-opening the same queue item.
    res = await client.patch(
        f"/api/v1/pets/{pet['id']}", json={"traits": ["bitey"]}, headers=auth_headers
    )
    assert res.status_code == 400
    assert "isn't available" in res.json()["detail"]


@pytest.mark.asyncio
async def test_delete_removes_the_trait_from_pets(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    pet = await _create_pet(client, auth_headers, traits=["Tail chaser", "Loud snorer"])
    trait = await _find_trait(client, admin_headers, "tail-chaser")

    res = await client.delete(
        f"/api/v1/admin/pet-traits/{trait['id']}", headers=admin_headers
    )
    assert res.status_code == 200, res.text
    assert res.json()["pets_stripped"] == 1

    res = await client.get(f"/api/v1/pets/{pet['id']}", headers=auth_headers)
    assert res.json()["traits"] == ["Loud snorer"]


@pytest.mark.asyncio
async def test_duplicate_admin_trait_is_rejected(client: AsyncClient, admin_headers: dict):
    res = await client.post(
        "/api/v1/admin/pet-traits", json={"label": "Chatty"}, headers=admin_headers
    )
    assert res.status_code == 201, res.text
    res = await client.post(
        "/api/v1/admin/pet-traits", json={"label": "chatty"}, headers=admin_headers
    )
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_trait_admin_requires_admin(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/admin/pet-traits", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_status_filter_returns_the_review_queue(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    await _create_pet(client, auth_headers, traits=["Puddle jumper"])
    res = await client.get(
        "/api/v1/admin/pet-traits?status=pending&limit=200", headers=admin_headers
    )
    assert res.status_code == 200, res.text
    labels = [t["label"] for t in res.json()]
    assert "Puddle jumper" in labels
    assert all(t["status"] == "pending" for t in res.json())
