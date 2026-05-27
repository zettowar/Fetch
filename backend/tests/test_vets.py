import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_vet_admin_only(client: AsyncClient, admin_headers: dict):
    res = await client.post(
        "/api/v1/vets",
        json={
            "name": "Mission Pet Hospital",
            "lat": 37.7749,
            "lng": -122.4194,
            "address": "123 Mission St",
            "phone": "+1-415-555-0100",
            "website": "https://example-vet.com",
            "hours": "Mo-Fr 09:00-18:00",
            "attributes": {"emergency": True},
        },
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "Mission Pet Hospital"
    assert body["attributes"]["emergency"] is True


@pytest.mark.asyncio
async def test_create_vet_forbidden_for_regular_user(
    client: AsyncClient, auth_headers: dict,
):
    res = await client.post(
        "/api/v1/vets",
        json={"name": "User Tried", "lat": 0, "lng": 0},
        headers=auth_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_get_vet(
    client: AsyncClient, auth_headers: dict, admin_headers: dict,
):
    create_res = await client.post(
        "/api/v1/vets",
        json={"name": "Get Vet", "lat": 37.78, "lng": -122.42},
        headers=admin_headers,
    )
    vet_id = create_res.json()["id"]

    res = await client.get(f"/api/v1/vets/{vet_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Get Vet"


@pytest.mark.asyncio
async def test_nearby_vets(
    client: AsyncClient, auth_headers: dict, admin_headers: dict,
):
    await client.post(
        "/api/v1/vets",
        json={"name": "Nearby Vet", "lat": 37.77, "lng": -122.42},
        headers=admin_headers,
    )

    res = await client.get(
        "/api/v1/vets/nearby",
        params={"lat": 37.77, "lng": -122.42, "radius_km": 5},
        headers=auth_headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert any(v["name"] == "Nearby Vet" for v in body)


@pytest.mark.asyncio
async def test_update_vet_admin_only(
    client: AsyncClient, auth_headers: dict, admin_headers: dict,
):
    create_res = await client.post(
        "/api/v1/vets",
        json={"name": "Edit Vet", "lat": 37.78, "lng": -122.42},
        headers=admin_headers,
    )
    vet_id = create_res.json()["id"]

    # Regular user can't edit.
    res = await client.patch(
        f"/api/v1/vets/{vet_id}",
        json={"name": "Hacked"},
        headers=auth_headers,
    )
    assert res.status_code == 403

    # Admin can.
    res = await client.patch(
        f"/api/v1/vets/{vet_id}",
        json={"name": "Edited Vet", "phone": "+1-415-555-0200"},
        headers=admin_headers,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Edited Vet"
    assert res.json()["phone"] == "+1-415-555-0200"


@pytest.mark.asyncio
async def test_vets_requires_auth(client: AsyncClient):
    res = await client.get(
        "/api/v1/vets/nearby",
        params={"lat": 37, "lng": -122, "radius_km": 5},
    )
    assert res.status_code in (401, 403)
