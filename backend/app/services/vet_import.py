"""Import veterinary clinics from OpenStreetMap via the Overpass API.

OSM tag `amenity=veterinary` covers most clinics; `healthcare=veterinary`
catches a few extras tagged with the newer healthcare schema. All the
fetching and upsert machinery lives in osm_import.py; this module only
supplies the vet-specific tag mapping (plus phone/website/hours extras).
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vet import Vet
from app.services.osm_import import (
    DEFAULT_TIMEOUT_SECONDS,
    ImportResult,
    OsmImportConfig,
    fetch_osm_elements,
    import_osm_elements,
)

__all__ = ["ImportResult", "fetch_osm_vets", "import_osm_vets"]


def _extract_attributes(tags: dict[str, Any]) -> dict[str, Any]:
    """Map OSM tags onto our `attributes` JSONB structure.

    Heuristics — OSM tagging for emergency vs 24/7 vs house-calls is loose
    in practice, so we accept a few likely keys."""
    attrs: dict[str, Any] = {}
    if tags.get("emergency") == "yes" or tags.get("healthcare:speciality") == "emergency":
        attrs["emergency"] = True
    if tags.get("opening_hours") == "24/7" or tags.get("24/7") == "yes":
        attrs["open_24_7"] = True
    if tags.get("house_visits") == "yes" or tags.get("service:house_calls") == "yes":
        attrs["house_calls"] = True
    if tags.get("boarding") == "yes" or "boarding" in (tags.get("service") or ""):
        attrs["boarding"] = True
    if tags.get("grooming") == "yes" or "grooming" in (tags.get("service") or ""):
        attrs["grooming"] = True
    return attrs


def _extract_extras(tags: dict[str, Any]) -> dict[str, Any]:
    return {
        "phone": tags.get("phone") or tags.get("contact:phone") or None,
        "website": tags.get("website") or tags.get("contact:website") or None,
        "hours": tags.get("opening_hours"),
    }


VET_IMPORT = OsmImportConfig(
    entity="vet",
    model=Vet,
    selectors=['"amenity"="veterinary"', '"healthcare"="veterinary"'],
    extract_attributes=_extract_attributes,
    extract_extras=_extract_extras,
)


async def fetch_osm_vets(
    bbox: tuple[float, float, float, float] | None = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> list[dict[str, Any]]:
    return await fetch_osm_elements(VET_IMPORT, bbox=bbox, timeout=timeout)


async def import_osm_vets(
    db: AsyncSession,
    bbox: tuple[float, float, float, float] | None = None,
) -> ImportResult:
    return await import_osm_elements(db, VET_IMPORT, bbox=bbox)
