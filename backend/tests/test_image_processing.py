"""The shared upload processor: what every stored image is guaranteed to be."""
import io
import uuid

import pytest
from httpx import AsyncClient
from PIL import Image

from app.services.image_processing import ImageRejected, process_image

ALLOWED = {"image/jpeg", "image/png", "image/webp"}
RED, BLUE = (220, 30, 30), (30, 30, 220)
ORIENTATION, MAKE = 0x0112, 0x010F


def _sideways_jpeg(orientation: int, *, with_make: bool = False) -> bytes:
    """A 60×30 photo, red on the left half and blue on the right, stored with
    an EXIF orientation tag — what a phone camera hands over."""
    img = Image.new("RGB", (60, 30), BLUE)
    img.paste(RED, (0, 0, 30, 30))
    exif = Image.Exif()
    exif[ORIENTATION] = orientation
    if with_make:
        exif[MAKE] = "TestCam"
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95, exif=exif.tobytes())
    return buf.getvalue()


def _process(data: bytes, **kw):
    return process_image(data, max_dim=1600, max_pixels=30_000_000, allowed_types=ALLOWED, **kw)


def _open(out) -> Image.Image:
    return Image.open(io.BytesIO(out.data))


def _near(pixel, colour, tol=40) -> bool:
    return all(abs(int(a) - b) <= tol for a, b in zip(pixel[:3], colour))


@pytest.mark.parametrize(
    "orientation, size, red_at, blue_at",
    [
        # 1: as stored. 3: upside down. 6: needs 90° CW (a portrait phone shot).
        # 8: needs 90° CCW. 2: mirrored.
        (1, (60, 30), (10, 15), (50, 15)),
        (3, (60, 30), (50, 15), (10, 15)),
        (6, (30, 60), (15, 10), (15, 50)),
        (8, (30, 60), (15, 50), (15, 10)),
        (2, (60, 30), (50, 15), (10, 15)),
    ],
)
def test_photos_are_stored_upright(orientation, size, red_at, blue_at):
    """The orientation tag is applied, not just dropped — dropping it alone
    stored every portrait phone photo on its side."""
    out = _process(_sideways_jpeg(orientation))
    img = _open(out).convert("RGB")
    assert img.size == size == (out.width, out.height)
    assert _near(img.getpixel(red_at), RED)
    assert _near(img.getpixel(blue_at), BLUE)


def test_metadata_is_stripped():
    out = _process(_sideways_jpeg(6, with_make=True))
    exif = _open(out).getexif()
    assert ORIENTATION not in exif  # applied, so a viewer can't apply it twice
    assert MAKE not in exif


def test_transparency_flattens_to_white_not_black_in_a_jpeg():
    """JPEG has no alpha, and a plain RGB conversion paints empty areas black."""
    from app.services.image_processing import _for_jpeg

    rgba = Image.new("RGBA", (40, 40), (0, 0, 0, 0))
    rgba.paste((200, 100, 50, 255), (10, 10, 30, 30))
    flat = _for_jpeg(rgba)
    assert flat.mode == "RGB"
    assert _near(flat.getpixel((2, 2)), (255, 255, 255), tol=4)
    assert _near(flat.getpixel((20, 20)), (200, 100, 50), tol=8)


def test_png_keeps_its_alpha():
    rgba = Image.new("RGBA", (20, 20), (0, 0, 0, 0))
    buf = io.BytesIO()
    rgba.save(buf, format="PNG")
    out = _process(buf.getvalue())
    assert out.content_type == "image/png"
    assert _open(out).mode in ("RGBA", "P")


def test_cmyk_becomes_rgb():
    buf = io.BytesIO()
    Image.new("CMYK", (20, 20), (0, 255, 255, 0)).save(buf, format="JPEG")
    out = _process(buf.getvalue())
    assert _open(out).mode == "RGB"


def test_long_edge_is_capped_without_distortion():
    buf = io.BytesIO()
    Image.new("RGB", (4000, 1000), RED).save(buf, format="JPEG")
    out = process_image(buf.getvalue(), max_dim=1600, max_pixels=30_000_000, allowed_types=ALLOWED)
    assert (out.width, out.height) == (1600, 400)


def test_rejects_what_isnt_an_image():
    with pytest.raises(ImageRejected):
        _process(b"not an image at all")


@pytest.mark.asyncio
async def test_sideways_phone_photo_uploads_upright(client: AsyncClient, auth_headers: dict):
    """End to end through the real endpoint: a portrait shot stored sideways
    with a rotate tag comes back from storage as a portrait."""
    pet = await client.post("/api/v1/pets", json={"name": f"Upright-{uuid.uuid4().hex[:6]}"}, headers=auth_headers)
    pet_id = pet.json()["id"]
    res = await client.post(
        f"/api/v1/pets/{pet_id}/photos",
        files={"file": ("phone.jpg", _sideways_jpeg(6), "image/jpeg")},
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text
    photo = res.json()
    assert (photo["width"], photo["height"]) == (30, 60)
