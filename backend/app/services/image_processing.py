"""One routine for every image upload: pet photos, sighting photos, rescue
logos and covers.

What it guarantees about the stored file:

- **Upright.** Phones store photos sideways and add an EXIF "rotate me" tag.
  The re-encode drops all metadata (for privacy: a phone photo carries the GPS
  fix of wherever it was taken), so the tag has to be *applied* first or the
  photo is stored sideways for good. This used to happen: orientation was
  stripped, never applied.
- **No metadata.** EXIF is not carried over. The colour profile is, when the
  pixels stay in its colour space (it holds no location and keeps phone
  photos' Display-P3 colour from washing out).
- **No black where there was nothing.** JPEG has no transparency; converting
  a transparent image straight to RGB paints the empty areas black. Alpha is
  flattened onto white instead. PNG and WebP keep their alpha.
- **Displayable colour.** CMYK (print) JPEGs are converted to RGB, which every
  browser renders; some render CMYK JPEGs with inverted or shifted colour.
- **Bounded.** The long edge is capped at ``max_dim`` and the pixel count is
  checked from the header before any pixels are decoded.
"""
from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps


_MAX_ICC_BYTES = 1_000_000


class ImageRejected(ValueError):
    """The upload isn't an image we accept. The message is safe to show."""


@dataclass(frozen=True)
class ProcessedImage:
    data: bytes
    content_type: str
    width: int
    height: int


_ALPHA_MODES = {"RGBA", "LA", "PA", "RGBa", "La"}


def _has_alpha(img: Image.Image) -> bool:
    return img.mode in _ALPHA_MODES or (img.mode == "P" and "transparency" in img.info)


def _colour_family(mode: str) -> str:
    if mode == "CMYK":
        return "CMYK"
    if mode in {"1", "L", "LA", "La", "I", "I;16", "I;16B", "I;16L", "F"}:
        return "GRAY"
    return "RGB"


def _flatten_on_white(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    base = Image.new("RGB", rgba.size, (255, 255, 255))
    base.paste(rgba, mask=rgba.getchannel("A"))
    return base


def _for_jpeg(img: Image.Image) -> Image.Image:
    if _has_alpha(img):
        return _flatten_on_white(img)
    if img.mode in ("RGB", "L"):
        return img
    return img.convert("RGB")


def _for_webp(img: Image.Image) -> Image.Image:
    if img.mode in ("RGB", "RGBA"):
        return img
    return img.convert("RGBA" if _has_alpha(img) else "RGB")


def _for_png(img: Image.Image) -> Image.Image:
    # PNG holds everything but CMYK, which can't reach this path (PNG has no
    # CMYK); convert defensively anyway.
    return img.convert("RGB") if img.mode == "CMYK" else img


def _fit(img: Image.Image, max_dim: int) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_dim:
        return img
    scale = max_dim / max(w, h)
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    return img.resize(size, Image.LANCZOS)


def process_image(
    data: bytes,
    *,
    max_dim: int,
    max_pixels: int,
    allowed_types: set[str],
    fallback_content_type: str | None = None,
) -> ProcessedImage:
    """Validate, orient, bound and re-encode an upload. CPU-bound: call it
    from a worker thread in request handlers."""
    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()
        img = Image.open(io.BytesIO(data))  # verify() leaves the file unusable
    except Exception:
        raise ImageRejected("Invalid image file")

    # MPO is a JPEG with extra frames appended (depth map, burst) — what a fair
    # number of phone cameras write. Pillow names it separately, so it used to
    # be turned away as "not a JPEG". The first frame is the photo.
    fmt = "JPEG" if img.format == "MPO" else img.format
    content_type = f"image/{fmt.lower()}" if fmt else fallback_content_type
    if content_type not in allowed_types:
        raise ImageRejected("Only JPEG, PNG, and WebP are allowed")

    width, height = img.size  # from the header — nothing decoded yet
    if width * height > max_pixels:
        raise ImageRejected("Image dimensions are too large (over 30 megapixels)")

    save_format = (fmt or "JPEG").upper()
    source_family = _colour_family(img.mode)
    icc = img.info.get("icc_profile")
    # A colour profile is a few kilobytes. It is copied through unparsed, so
    # without a ceiling it is also somewhere to park megabytes of anything.
    if icc and len(icc) > _MAX_ICC_BYTES:
        icc = None

    try:
        # Upright first, while the orientation tag is still there to read.
        # In place: the default returns a second full bitmap, which doubled the
        # peak memory of every upload (two 30 MP images are ~240 MB a worker).
        ImageOps.exif_transpose(img, in_place=True)
        img = _fit(img, max_dim)
        if save_format == "PNG":
            img = _for_png(img)
        elif save_format == "WEBP":
            img = _for_webp(img)
        else:
            img = _for_jpeg(img)
    except ImageRejected:
        raise
    except Exception:
        # A header that verifies but pixel data that won't decode.
        raise ImageRejected("Invalid image file")

    extra = {}
    if icc and _colour_family(img.mode) == source_family:
        extra["icc_profile"] = icc
    # "No metadata" has to include the JPEG comment segment, which Pillow's
    # writer copies from `info` unasked.
    img.info.pop("comment", None)

    buf = io.BytesIO()
    if save_format == "PNG":
        img.save(buf, format="PNG", optimize=True, **extra)
    elif save_format == "WEBP":
        img.save(buf, format="WEBP", quality=85, **extra)
    else:
        img.save(buf, format="JPEG", quality=85, optimize=True, progressive=True, **extra)
    return ProcessedImage(buf.getvalue(), content_type, img.size[0], img.size[1])
