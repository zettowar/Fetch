"""Tests for dog photo uploads and lost-report sighting photos."""
import io

import pytest
from httpx import AsyncClient
from PIL import Image


def _make_jpeg(size: tuple[int, int] = (200, 200), color: str = "red") -> bytes:
    """Build a tiny valid JPEG in memory."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return buf.getvalue()


def _make_png(size: tuple[int, int] = (120, 80)) -> bytes:
    img = Image.new("RGBA", size, color=(0, 200, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _create_dog(client: AsyncClient, auth_headers: dict) -> str:
    res = await client.post("/api/v1/dogs", json={"name": "PhotoPup"}, headers=auth_headers)
    assert res.status_code == 201, res.text
    return res.json()["id"]


# --- Dog photo uploads ---

@pytest.mark.asyncio
async def test_upload_dog_photo_jpeg(client: AsyncClient, auth_headers: dict):
    dog_id = await _create_dog(client, auth_headers)
    res = await client.post(
        f"/api/v1/dogs/{dog_id}/photos",
        files={"file": ("pup.jpg", _make_jpeg(), "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["dog_id"] == dog_id
    assert data["content_type"] == "image/jpeg"
    assert data["width"] > 0 and data["height"] > 0


@pytest.mark.asyncio
async def test_upload_dog_photo_png(client: AsyncClient, auth_headers: dict):
    dog_id = await _create_dog(client, auth_headers)
    res = await client.post(
        f"/api/v1/dogs/{dog_id}/photos",
        files={"file": ("pup.png", _make_png(), "image/png")},
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    assert res.json()["content_type"] == "image/png"


@pytest.mark.asyncio
async def test_upload_dog_photo_rejects_non_image(client: AsyncClient, auth_headers: dict):
    dog_id = await _create_dog(client, auth_headers)
    res = await client.post(
        f"/api/v1/dogs/{dog_id}/photos",
        files={"file": ("bad.jpg", b"not-an-image", "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_upload_dog_photo_requires_ownership(client: AsyncClient, auth_headers: dict):
    dog_id = await _create_dog(client, auth_headers)
    # Different user
    import uuid
    email = f"other-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    r = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Other",
    })
    other_headers = {"Authorization": f"Bearer {r.json()['tokens']['access_token']}"}
    res = await client.post(
        f"/api/v1/dogs/{dog_id}/photos",
        files={"file": ("x.jpg", _make_jpeg(), "image/jpeg")},
        headers=other_headers,
    )
    assert res.status_code == 403


# --- Sighting photo uploads ---

@pytest.mark.asyncio
async def test_add_sighting_with_photo(client: AsyncClient, auth_headers: dict):
    import uuid
    # Reporter creates a missing report.
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Missing dog — sighting test",
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    # A different user adds a sighting with a photo.
    email = f"sighter-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    r = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Sighter",
    })
    sighter_headers = {"Authorization": f"Bearer {r.json()['tokens']['access_token']}"}

    res = await client.post(
        f"/api/v1/lost/reports/{report_id}/sightings",
        data={"lat": "37.78", "lng": "-122.41", "note": "With photo"},
        files={"photo": ("sight.jpg", _make_jpeg(), "image/jpeg")},
        headers=sighter_headers,
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["note"] == "With photo"
    assert data["photo_url"] is not None


@pytest.mark.asyncio
async def test_add_sighting_rejects_bad_photo(client: AsyncClient, auth_headers: dict):
    create_res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "description": "Bad photo test",
    }, headers=auth_headers)
    report_id = create_res.json()["id"]

    res = await client.post(
        f"/api/v1/lost/reports/{report_id}/sightings",
        data={"lat": "37.78", "lng": "-122.41"},
        files={"photo": ("bad.jpg", b"not-an-image", "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 400
