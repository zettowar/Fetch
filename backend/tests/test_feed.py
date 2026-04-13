import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_feed_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/feed/next")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_feed_returns_list(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/feed/next", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_vote_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/votes", json={
        "dog_id": "00000000-0000-0000-0000-000000000000",
        "value": 1,
    })
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_vote_invalid_value(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/votes", json={
        "dog_id": "00000000-0000-0000-0000-000000000000",
        "value": 5,
    }, headers=auth_headers)
    assert res.status_code == 422
