import uuid

import pytest
from httpx import AsyncClient


async def _gen_codes(client: AsyncClient, admin_headers: dict, count: int = 3) -> list[str]:
    res = await client.post(
        "/api/v1/admin/tags/generate", json={"count": count}, headers=admin_headers
    )
    assert res.status_code == 200, res.text
    return res.json()["codes"]


async def _make_pet(client: AsyncClient, headers: dict, name: str = "TagPup") -> str:
    res = await client.post("/api/v1/pets", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.asyncio
async def test_tag_generate_is_admin_only(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/admin/tags/generate", json={"count": 2}, headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_claim_and_public_scan_flow(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    code = (await _gen_codes(client, admin_headers, 1))[0]
    pet_id = await _make_pet(client, auth_headers)

    # Unassigned scan.
    scan = await client.get(f"/api/v1/public/tags/{code}")
    assert scan.status_code == 200
    assert scan.json()["assigned"] is False

    # Owner claims it.
    claim = await client.post(
        "/api/v1/tags/claim", json={"code": code, "pet_id": pet_id}, headers=auth_headers
    )
    assert claim.status_code == 200
    assert claim.json()["pet_id"] == pet_id

    # Assigned scan resolves to the (public) pet.
    scan2 = await client.get(f"/api/v1/public/tags/{code}")
    assert scan2.status_code == 200
    assert scan2.json()["assigned"] is True
    assert scan2.json()["pet"]["id"] == pet_id

    # Double-claim is rejected.
    again = await client.post(
        "/api/v1/tags/claim", json={"code": code, "pet_id": pet_id}, headers=auth_headers
    )
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_claim_requires_owning_the_pet(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    # A second user's pet.
    other = await client.post("/api/v1/auth/signup", json={
        "email": f"tagother-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "password123", "display_name": "Other",
    })
    other_headers = {"Authorization": f"Bearer {other.json()['tokens']['access_token']}"}
    other_pet = await _make_pet(client, other_headers, "NotYours")

    code = (await _gen_codes(client, admin_headers, 1))[0]
    res = await client.post(
        "/api/v1/tags/claim", json={"code": code, "pet_id": other_pet}, headers=auth_headers
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_unknown_code_scans_404(client: AsyncClient):
    res = await client.get("/api/v1/public/tags/NOPENOPE")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_admin_assign_tag(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    pet_id = await _make_pet(client, auth_headers, "AdminAssigned")
    code = (await _gen_codes(client, admin_headers, 1))[0]

    res = await client.post(
        f"/api/v1/admin/tags/{code}/assign", json={"pet_id": pet_id}, headers=admin_headers
    )
    assert res.status_code == 200
    assert res.json()["pet_id"] == pet_id

    # Shows up in the assigned filter.
    listing = await client.get("/api/v1/admin/tags", params={"assigned": True}, headers=admin_headers)
    assert listing.status_code == 200
    assert any(t["code"] == code for t in listing.json())


@pytest.mark.asyncio
async def test_unlink_returns_tag_to_pool(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    code = (await _gen_codes(client, admin_headers, 1))[0]
    pet_id = await _make_pet(client, auth_headers, "Unlinkable")
    await client.post("/api/v1/tags/claim", json={"code": code, "pet_id": pet_id}, headers=auth_headers)

    unlink = await client.delete(f"/api/v1/tags/{code}", headers=auth_headers)
    assert unlink.status_code == 200

    scan = await client.get(f"/api/v1/public/tags/{code}")
    assert scan.json()["assigned"] is False
