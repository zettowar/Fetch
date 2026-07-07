"""Import pet parks from OpenStreetMap via the Overpass API.

OSM tag `leisure=dog_park` marks fenced/official pet parks. All the fetching
and upsert machinery lives in osm_import.py; this module only supplies the
park-specific tag mapping.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.park import Park
from app.services.osm_import import (
    DEFAULT_TIMEOUT_SECONDS,
    ImportResult,
    OsmImportConfig,
    fetch_osm_elements,
    import_osm_elements,
)

__all__ = ["ImportResult", "fetch_osm_dog_parks", "import_osm_dog_parks"]


def _extract_attributes(tags: dict[str, Any]) -> dict[str, Any]:
    """Map a subset of OSM tags to our `attributes` JSONB structure."""
    attrs: dict[str, Any] = {}
    if "barrier" in tags or tags.get("fence") == "yes":
        attrs["fenced"] = True
    if tags.get("pet") == "leashed":
        attrs["off_leash_legal"] = False
    elif tags.get("pet") == "yes" or tags.get("dog_park") == "yes":
        attrs["off_leash_legal"] = True
    if tags.get("drinking_water") == "yes" or tags.get("amenity") == "drinking_water":
        attrs["water"] = True
    if tags.get("lit") == "yes":
        attrs["lights"] = True
    if tags.get("toilets") == "yes":
        attrs["restrooms"] = True
    if tags.get("parking") == "yes":
        attrs["parking"] = True
    return attrs


PARK_IMPORT = OsmImportConfig(
    entity="park",
    model=Park,
    selectors=['"leisure"="dog_park"'],
    extract_attributes=_extract_attributes,
)


async def fetch_osm_dog_parks(
    bbox: tuple[float, float, float, float] | None = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> list[dict[str, Any]]:
    return await fetch_osm_elements(PARK_IMPORT, bbox=bbox, timeout=timeout)


async def import_osm_dog_parks(
    db: AsyncSession,
    bbox: tuple[float, float, float, float] | None = None,
) -> ImportResult:
    return await import_osm_elements(db, PARK_IMPORT, bbox=bbox)
