"""Import dog parks from OpenStreetMap via the Overpass API.

OSM tags `leisure=dog_park` marks fenced/official dog parks. We pull nodes,
ways, and relations, then upsert by (source='osm', external_id=<osm_id>) so
re-runs are safe and only touched rows change.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.park import Park

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_TIMEOUT_SECONDS = 120


@dataclass
class ImportResult:
    created: int
    updated: int
    total_fetched: int
    errors: list[str]

    def to_dict(self) -> dict:
        return {
            "created": self.created,
            "updated": self.updated,
            "total_fetched": self.total_fetched,
            "errors": self.errors,
        }


def _build_query(bbox: tuple[float, float, float, float] | None) -> str:
    """Compose an Overpass QL query. `bbox` is (south, west, north, east)."""
    if bbox:
        south, west, north, east = bbox
        bbox_clause = f"({south},{west},{north},{east})"
    else:
        bbox_clause = ""
    return f"""
    [out:json][timeout:{DEFAULT_TIMEOUT_SECONDS}];
    (
      node["leisure"="dog_park"]{bbox_clause};
      way["leisure"="dog_park"]{bbox_clause};
      relation["leisure"="dog_park"]{bbox_clause};
    );
    out center tags;
    """.strip()


def _extract_address(tags: dict[str, Any]) -> str | None:
    """Build a readable street address from OSM addr:* tags, or fall back
    to whatever single location-ish tag we have."""
    parts = []
    for key in ("addr:housenumber", "addr:street"):
        if tags.get(key):
            parts.append(tags[key])
    street = " ".join(parts) if parts else None

    city = tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:village")
    state = tags.get("addr:state")
    country = tags.get("addr:country")

    pieces = [p for p in [street, city, state, country] if p]
    if pieces:
        return ", ".join(pieces)

    # Last resort: the OSM "loc_name" or "locality" tag.
    return tags.get("loc_name") or tags.get("locality") or None


def _extract_attributes(tags: dict[str, Any]) -> dict[str, Any]:
    """Map a subset of OSM tags to our `attributes` JSONB structure."""
    attrs: dict[str, Any] = {}
    if "barrier" in tags or tags.get("fence") == "yes":
        attrs["fenced"] = True
    if tags.get("dog") == "leashed":
        attrs["off_leash_legal"] = False
    elif tags.get("dog") == "yes" or tags.get("dog_park") == "yes":
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


def _parse_element(elem: dict[str, Any]) -> dict[str, Any] | None:
    """Turn one OSM element into our park row shape, or None if unusable."""
    tags = elem.get("tags") or {}
    name = tags.get("name") or tags.get("official_name") or tags.get("alt_name")
    if not name:
        # Skip unnamed elements — they're almost impossible to show to users.
        return None

    if elem.get("type") == "node":
        lat = elem.get("lat")
        lng = elem.get("lon")
    else:
        center = elem.get("center") or {}
        lat = center.get("lat")
        lng = center.get("lon")
    if lat is None or lng is None:
        return None

    osm_id = f"{elem.get('type')}/{elem.get('id')}"
    return {
        "external_id": osm_id,
        "name": name[:200],
        "address": _extract_address(tags),
        "lat": float(lat),
        "lng": float(lng),
        "attributes": _extract_attributes(tags) or None,
    }


async def fetch_osm_dog_parks(
    bbox: tuple[float, float, float, float] | None = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> list[dict[str, Any]]:
    """Query Overpass. Returns a list of parsed park dicts (one per OSM element)."""
    query = _build_query(bbox)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()
        payload = resp.json()

    elements = payload.get("elements") or []
    parsed: list[dict[str, Any]] = []
    for e in elements:
        row = _parse_element(e)
        if row is not None:
            parsed.append(row)
    return parsed


async def import_osm_dog_parks(
    db: AsyncSession,
    bbox: tuple[float, float, float, float] | None = None,
) -> ImportResult:
    """Fetch from Overpass and upsert into our `parks` table.

    Only rows where `source='osm'` are touched — user-submitted rows are safe.
    OSM rows are marked `verified=True` on creation (OSM has moderation).
    """
    parsed = await fetch_osm_dog_parks(bbox=bbox)
    if not parsed:
        return ImportResult(created=0, updated=0, total_fetched=0, errors=[])

    # Load existing OSM-sourced rows into a map keyed by external_id for
    # cheap lookup + upsert.
    existing_res = await db.execute(
        select(Park).where(Park.source == "osm")
    )
    by_external: dict[str, Park] = {}
    for p in existing_res.scalars().all():
        if p.external_id:
            by_external[p.external_id] = p

    created = 0
    updated = 0
    errors: list[str] = []

    for row in parsed:
        try:
            existing = by_external.get(row["external_id"])
            if existing is None:
                park = Park(
                    name=row["name"],
                    address=row["address"],
                    lat=row["lat"],
                    lng=row["lng"],
                    attributes=row["attributes"],
                    source="osm",
                    external_id=row["external_id"],
                    verified=True,
                )
                db.add(park)
                created += 1
            else:
                # Refresh mutable fields. Don't wipe verified/created_by/reviews.
                existing.name = row["name"]
                existing.address = row["address"]
                existing.lat = row["lat"]
                existing.lng = row["lng"]
                # Only replace attributes if the import actually has some,
                # otherwise keep whatever was there.
                if row["attributes"]:
                    existing.attributes = row["attributes"]
                updated += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{row.get('external_id')}: {exc}")
            logger.exception("park_import_row_failed", extra={"row": row})

    await db.commit()
    logger.info(
        "park_import_complete created=%s updated=%s total=%s errors=%s",
        created, updated, len(parsed), len(errors),
    )
    return ImportResult(
        created=created,
        updated=updated,
        total_fetched=len(parsed),
        errors=errors[:20],  # cap to keep response size sane
    )
