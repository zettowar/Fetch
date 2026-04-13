import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_submit_feedback(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/feedback", json={
        "body": "Love this app!",
        "screen_name": "/home",
    }, headers=auth_headers)
    assert res.status_code == 201
    assert res.json()["body"] == "Love this app!"


@pytest.mark.asyncio
async def test_admin_list_feedback(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    # Submit feedback first
    await client.post("/api/v1/feedback", json={
        "body": "Admin visible feedback"
    }, headers=auth_headers)

    res = await client.get("/api/v1/feedback", headers=admin_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_generate_invite_codes(client: AsyncClient, admin_headers: dict):
    res = await client.post("/api/v1/invites/generate", json={
        "count": 5,
    }, headers=admin_headers)
    assert res.status_code == 200
    assert len(res.json()) == 5
    assert all(c["code"].startswith("FETCH-") for c in res.json())


@pytest.mark.asyncio
async def test_list_invite_codes(client: AsyncClient, admin_headers: dict):
    await client.post("/api/v1/invites/generate", json={"count": 3}, headers=admin_headers)
    res = await client.get("/api/v1/invites", headers=admin_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 3


@pytest.mark.asyncio
async def test_feedback_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/feedback", json={"body": "test"})
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_invites_require_admin(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/invites/generate", json={"count": 1}, headers=auth_headers)
    assert res.status_code == 403
