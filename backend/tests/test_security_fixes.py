"""Regression tests for the Phase 1 security fixes.

Covers: path-traversal in LocalStorage, lost-report status mass-assignment,
and lost-dog sighting coordinate privacy fuzzing.
"""
import pytest
from httpx import AsyncClient

from app.storage import LocalStorage


@pytest.mark.asyncio
async def test_storage_rejects_path_traversal(tmp_path):
    """LocalStorage must not read/write outside its base directory."""
    secret = tmp_path / "secret.txt"
    secret.write_text("top secret")
    base = tmp_path / "uploads"
    storage = LocalStorage(str(base))

    # A normal flat key round-trips.
    await storage.put("ok.txt", b"hello", "text/plain")
    assert await storage.get("ok.txt") == b"hello"

    # Traversal and absolute keys are rejected (surface as 404 to callers).
    for evil in ("../secret.txt", "../../etc/passwd", "/etc/passwd"):
        with pytest.raises(FileNotFoundError):
            await storage.get(evil)


def test_cors_wildcard_origin_rejected():
    """A '*' origin with credentials must fail fast at config load."""
    from app.config import Settings

    with pytest.raises(ValueError):
        Settings(CORS_ORIGINS="*", JWT_SECRET="x" * 40)


def test_debug_tokens_rejected_in_production():
    """Debug token leakage flags must be refused when ENVIRONMENT=production."""
    from app.config import Settings

    with pytest.raises(ValueError):
        Settings(ENVIRONMENT="production", DEBUG_RESET_TOKEN=True, JWT_SECRET="x" * 40)
    # ...but allowed in development.
    s = Settings(ENVIRONMENT="development", DEBUG_RESET_TOKEN=True, JWT_SECRET="x" * 40)
    assert s.DEBUG_RESET_TOKEN is True


async def _create_report(client: AsyncClient, headers: dict, **overrides) -> dict:
    payload = {
        "kind": "missing",
        "last_seen_lat": 37.7749,
        "last_seen_lng": -122.4194,
        "location_fuzz_m": 500,
        "description": "Lost near the park",
        "contact_method": "in_app",
    }
    payload.update(overrides)
    res = await client.post("/api/v1/lost/reports", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


@pytest.mark.asyncio
async def test_lost_report_update_cannot_set_status(client: AsyncClient, auth_headers: dict):
    """PATCH must not let a client mass-assign `status` (use /resolve instead)."""
    report = await _create_report(client, auth_headers)
    assert report["status"] == "open"

    # Attempt to sneak `status` through the update endpoint.
    res = await client.patch(
        f"/api/v1/lost/reports/{report['id']}",
        json={"status": "resolved", "description": "still looking"},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    # Description updates, but status is ignored — it's not an accepted field.
    assert res.json()["description"] == "still looking"
    assert res.json()["status"] == "open"


@pytest.mark.asyncio
async def test_sighting_coords_fuzzed_for_non_owner(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """Sighting coordinates are exact for the report owner, fuzzed for others."""
    exact_lat, exact_lng = 37.7749, -122.4194
    report = await _create_report(client, auth_headers)

    add = await client.post(
        f"/api/v1/lost/reports/{report['id']}/sightings",
        data={"lat": str(exact_lat), "lng": str(exact_lng), "note": "saw the dog"},
        headers=auth_headers,
    )
    assert add.status_code == 201, add.text

    # Owner sees exact coordinates.
    owner_view = await client.get(
        f"/api/v1/lost/reports/{report['id']}/sightings", headers=auth_headers
    )
    assert owner_view.status_code == 200
    owner_sighting = owner_view.json()[0]
    assert owner_sighting["lat"] == pytest.approx(exact_lat)
    assert owner_sighting["lng"] == pytest.approx(exact_lng)

    # A different user sees fuzzed coordinates (not the true location).
    other_view = await client.get(
        f"/api/v1/lost/reports/{report['id']}/sightings", headers=admin_headers
    )
    assert other_view.status_code == 200
    other_sighting = other_view.json()[0]
    assert other_sighting["lat"] != exact_lat
    assert other_sighting["lng"] != exact_lng
    # Deterministic fuzz: repeated reads return the same fuzzed point.
    other_view2 = await client.get(
        f"/api/v1/lost/reports/{report['id']}/sightings", headers=admin_headers
    )
    assert other_view2.json()[0]["lat"] == other_sighting["lat"]
