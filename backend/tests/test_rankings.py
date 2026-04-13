import pytest
from httpx import AsyncClient

from app.services.feed_service import current_week_bucket


@pytest.mark.asyncio
async def test_rankings_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/rankings/current")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_rankings_returns_list(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/rankings/current", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_winner_returns_null_when_none(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/rankings/winner/current", headers=auth_headers)
    assert res.status_code == 200


def test_week_bucket_returns_monday():
    from datetime import datetime, timezone
    # Wednesday 2026-01-07
    dt = datetime(2026, 1, 7, 12, 0, 0, tzinfo=timezone.utc)
    bucket = current_week_bucket(dt)
    assert bucket.weekday() == 0  # Monday
    assert bucket.isoformat() == "2026-01-05"
