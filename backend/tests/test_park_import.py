"""Test the OSM park import end-to-end with a mocked Overpass response."""
import uuid
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.park import Park


SAMPLE_OVERPASS = {
    "version": 0.6,
    "elements": [
        {
            "type": "node",
            "id": 111,
            "lat": 37.7695,
            "lon": -122.4323,
            "tags": {
                "leisure": "dog_park",
                "name": "Mission Dolores Dog Park",
                "fence": "yes",
                "dog": "yes",
                "addr:city": "San Francisco",
                "addr:state": "CA",
            },
        },
        {
            "type": "way",
            "id": 222,
            "center": {"lat": 40.7128, "lon": -74.0060},
            "tags": {
                "leisure": "dog_park",
                "name": "Madison Square Dog Run",
                "addr:city": "New York",
            },
        },
        # Element with no name — should be skipped silently.
        {"type": "node", "id": 333, "lat": 1.0, "lon": 1.0, "tags": {"leisure": "dog_park"}},
    ],
}


def _mock_overpass_response(payload):
    class _Resp:
        def raise_for_status(self):
            return None

        def json(self):
            return payload

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            return _Resp()

    return _Client


@pytest.mark.asyncio
async def test_import_inserts_new_parks(client: AsyncClient, admin_headers: dict):
    with patch(
        "app.services.park_import.httpx.AsyncClient",
        new=_mock_overpass_response(SAMPLE_OVERPASS),
    ):
        res = await client.post(
            "/api/v1/admin/parks/import-osm",
            json={"bbox": [37.7, -122.5, 37.8, -122.4]},
            headers=admin_headers,
        )
    assert res.status_code == 200, res.text
    body = res.json()
    # Two named elements; the unnamed element is silently skipped.
    assert body["total_fetched"] == 2
    # Rows may already exist from a previous test-suite run — what matters
    # is every parsed row was accounted for and nothing errored.
    assert body["created"] + body["updated"] == 2
    assert body["errors"] == []


@pytest.mark.asyncio
async def test_reimport_is_idempotent(client: AsyncClient, admin_headers: dict):
    """A second run with the same payload updates rows in place; nothing new."""
    with patch(
        "app.services.park_import.httpx.AsyncClient",
        new=_mock_overpass_response(SAMPLE_OVERPASS),
    ):
        first = await client.post(
            "/api/v1/admin/parks/import-osm",
            json={"bbox": None},
            headers=admin_headers,
        )
        second = await client.post(
            "/api/v1/admin/parks/import-osm",
            json={"bbox": None},
            headers=admin_headers,
        )
    assert first.status_code == 200
    assert second.status_code == 200
    # Re-run creates nothing new — each OSM id was already ingested.
    assert second.json()["created"] == 0
    assert second.json()["updated"] == 2


@pytest.mark.asyncio
async def test_user_park_row_is_untouched_by_import(
    client: AsyncClient, admin_headers: dict, auth_headers: dict,
):
    """User-submitted parks keep `source='user'` and survive OSM imports."""
    name = f"Local Patch {uuid.uuid4().hex[:8]}"
    manual = await client.post(
        "/api/v1/parks",
        json={"name": name, "lat": 37.9, "lng": -122.1, "attributes": {}},
        headers=admin_headers,
    )
    assert manual.status_code == 201, manual.text

    with patch(
        "app.services.park_import.httpx.AsyncClient",
        new=_mock_overpass_response(SAMPLE_OVERPASS),
    ):
        await client.post(
            "/api/v1/admin/parks/import-osm",
            json={"bbox": [0, 0, 1, 1]},
            headers=admin_headers,
        )

    from tests.conftest import test_session_factory
    async with test_session_factory() as db:
        rows = (await db.execute(select(Park).where(Park.name == name))).scalars().all()
    assert len(rows) == 1
    assert rows[0].source == "user"
    assert rows[0].external_id is None


@pytest.mark.asyncio
async def test_non_admin_cannot_import(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/api/v1/admin/parks/import-osm",
        json={"bbox": None},
        headers=auth_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_non_admin_cannot_create_park(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/api/v1/parks",
        json={"name": "sketchy", "lat": 0, "lng": 0, "attributes": {}},
        headers=auth_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_park_stats_and_history(client: AsyncClient, admin_headers: dict):
    with patch(
        "app.services.park_import.httpx.AsyncClient",
        new=_mock_overpass_response(SAMPLE_OVERPASS),
    ):
        await client.post(
            "/api/v1/admin/parks/import-osm",
            json={"bbox": [0, 0, 1, 1]},
            headers=admin_headers,
        )
    stats = await client.get("/api/v1/admin/parks/stats", headers=admin_headers)
    assert stats.status_code == 200
    assert stats.json()["by_source"].get("osm", 0) >= 2

    history = await client.get(
        "/api/v1/admin/parks/import-history", headers=admin_headers,
    )
    assert history.status_code == 200
    assert len(history.json()) >= 1
    first = history.json()[0]
    assert first["total_fetched"] >= 2
