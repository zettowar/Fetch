"""End-to-end coverage for the flagged-photo review queue.

Uploads are forced to "flagged" by monkeypatching check_image in the photos
router, then reviewed through the admin queue endpoints.
"""
import io

import pytest
from httpx import AsyncClient
from PIL import Image

import app.routers.photos as photos_router
from app.services.moderation import ModerationResult


def _jpeg() -> bytes:
    img = Image.new("RGB", (200, 200), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return buf.getvalue()


async def _upload_flagged(client: AsyncClient, auth_headers: dict, monkeypatch) -> dict:
    async def fake_check_image(data: bytes) -> ModerationResult:
        return ModerationResult(status="flagged", reason="nudity")

    monkeypatch.setattr(photos_router, "check_image", fake_check_image)

    pet_res = await client.post("/api/v1/pets", json={"name": "FlagPup"}, headers=auth_headers)
    pet_id = pet_res.json()["id"]
    res = await client.post(
        f"/api/v1/pets/{pet_id}/photos",
        files={"file": ("pup.jpg", _jpeg(), "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    assert res.json()["moderation_status"] == "flagged"
    return res.json()


@pytest.mark.asyncio
async def test_flagged_photo_file_is_withheld(client: AsyncClient, auth_headers: dict, monkeypatch):
    photo = await _upload_flagged(client, auth_headers, monkeypatch)
    res = await client.get(f"/api/v1/photos/file/{photo['storage_key']}")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_flagged_photo_hidden_from_dog_payload(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    photo = await _upload_flagged(client, auth_headers, monkeypatch)
    res = await client.get(f"/api/v1/pets/{photo['pet_id']}", headers=auth_headers)
    assert res.status_code == 200
    assert all(p["id"] != photo["id"] for p in res.json()["photos"])


@pytest.mark.asyncio
async def test_admin_queue_lists_and_serves_flagged_photo(
    client: AsyncClient, auth_headers: dict, admin_headers: dict, monkeypatch
):
    photo = await _upload_flagged(client, auth_headers, monkeypatch)

    listing = await client.get("/api/v1/admin/photos/flagged", headers=admin_headers)
    assert listing.status_code == 200
    assert any(p["id"] == photo["id"] for p in listing.json())
    entry = next(p for p in listing.json() if p["id"] == photo["id"])
    assert entry["pet_name"] == "FlagPup"

    # Reviewers can see the image even though the public endpoint withholds it.
    file_res = await client.get(
        f"/api/v1/admin/photos/{photo['id']}/file", headers=admin_headers
    )
    assert file_res.status_code == 200
    assert file_res.content.startswith(b"\xff\xd8")


@pytest.mark.asyncio
async def test_approve_publishes_photo(
    client: AsyncClient, auth_headers: dict, admin_headers: dict, monkeypatch
):
    photo = await _upload_flagged(client, auth_headers, monkeypatch)

    res = await client.post(
        f"/api/v1/admin/photos/{photo['id']}/approve", headers=admin_headers
    )
    assert res.status_code == 200

    file_res = await client.get(f"/api/v1/photos/file/{photo['storage_key']}")
    assert file_res.status_code == 200
    pet_res = await client.get(f"/api/v1/pets/{photo['pet_id']}", headers=auth_headers)
    assert any(p["id"] == photo["id"] for p in pet_res.json()["photos"])


@pytest.mark.asyncio
async def test_reject_deletes_photo(
    client: AsyncClient, auth_headers: dict, admin_headers: dict, monkeypatch
):
    photo = await _upload_flagged(client, auth_headers, monkeypatch)

    res = await client.post(
        f"/api/v1/admin/photos/{photo['id']}/reject", headers=admin_headers
    )
    assert res.status_code == 200

    listing = await client.get("/api/v1/admin/photos/flagged", headers=admin_headers)
    assert all(p["id"] != photo["id"] for p in listing.json())
    file_res = await client.get(
        f"/api/v1/admin/photos/{photo['id']}/file", headers=admin_headers
    )
    assert file_res.status_code == 404


@pytest.mark.asyncio
async def test_queue_requires_admin(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/admin/photos/flagged", headers=auth_headers)
    assert res.status_code == 403
