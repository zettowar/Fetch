"""End-to-end coverage for the flagged-photo review queue.

Uploads are forced to "flagged" by monkeypatching check_image in the photos
router, then reviewed through the admin queue endpoints.
"""
import io
import uuid

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


async def _signup(client: AsyncClient) -> dict:
    """A second regular user, for the "everyone else" half of the rules."""
    res = await client.post("/api/v1/auth/signup", json={
        "email": f"other-{uuid.uuid4().hex[:8]}@fetchapp.dev",
        "password": "testpass123",
        "display_name": "Someone Else",
    })
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['tokens']['access_token']}"}


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
async def test_owner_sees_own_flagged_photo_marked_in_review(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """The owner keeps sight of a photo held for review.

    Withholding it from the owner too is what made a flagged upload read as a
    failed one — success toast, then nothing. It comes back badged and without
    a `url`, because the public file route still won't serve it.
    """
    photo = await _upload_flagged(client, auth_headers, monkeypatch)
    res = await client.get(f"/api/v1/pets/{photo['pet_id']}", headers=auth_headers)
    assert res.status_code == 200

    entry = next(p for p in res.json()["photos"] if p["id"] == photo["id"])
    assert entry["moderation_status"] == "flagged"
    assert entry["url"] is None


@pytest.mark.asyncio
async def test_flagged_photo_stays_hidden_from_everyone_else(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    photo = await _upload_flagged(client, auth_headers, monkeypatch)
    pet_id = photo["pet_id"]
    owner_id = (
        await client.get(f"/api/v1/pets/{pet_id}", headers=auth_headers)
    ).json()["owner_id"]
    other = await _signup(client)

    # Another signed-in user reading the same pet, directly...
    res = await client.get(f"/api/v1/pets/{pet_id}", headers=other)
    assert res.status_code == 200
    assert all(p["id"] != photo["id"] for p in res.json()["photos"])

    # ...and via the owner's profile listing.
    res = await client.get(f"/api/v1/pets/by-user/{owner_id}", headers=other)
    assert res.status_code == 200
    pet = next(d for d in res.json() if d["id"] == pet_id)
    assert all(p["id"] != photo["id"] for p in pet["photos"])

    # The public share page needs no account at all — it must not leak either.
    res = await client.get(f"/api/v1/public/pets/{pet_id}")
    assert res.status_code == 200
    assert all(p.get("id") != photo["id"] for p in res.json().get("photos", []))


@pytest.mark.asyncio
async def test_owner_can_fetch_own_in_review_file_but_others_cannot(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    photo = await _upload_flagged(client, auth_headers, monkeypatch)

    res = await client.get(f"/api/v1/photos/{photo['id']}/file", headers=auth_headers)
    assert res.status_code == 200
    assert res.content.startswith(b"\xff\xd8")

    other = await _signup(client)
    res = await client.get(f"/api/v1/photos/{photo['id']}/file", headers=other)
    assert res.status_code == 404  # indistinguishable from "no such photo"

    res = await client.get(f"/api/v1/photos/{photo['id']}/file")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_in_review_photo_cannot_become_primary(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """A withheld primary would blank the pet's hero for everyone else."""
    photo = await _upload_flagged(client, auth_headers, monkeypatch)
    pet_res = await client.get(f"/api/v1/pets/{photo['pet_id']}", headers=auth_headers)
    assert pet_res.json()["primary_photo_id"] is None

    res = await client.post(
        f"/api/v1/pets/{photo['pet_id']}/primary-photo",
        json={"photo_id": photo["id"]},
        headers=auth_headers,
    )
    assert res.status_code == 400
    assert "still being reviewed" in res.json()["detail"]


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
    # Upload skipped the primary slot while the photo was held, so approving the
    # pet's only photo has to claim it — otherwise the pet stays hero-less.
    assert pet_res.json()["primary_photo_id"] == photo["id"]
    assert pet_res.json()["primary_photo_url"] is not None


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
