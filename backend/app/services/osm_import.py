"""Shared machinery for importing points of interest from OpenStreetMap.

park_import.py and vet_import.py were ~90% identical; each is now a thin
`OsmImportConfig` over this module. The flow: query Overpass for the
configured tag selectors, parse elements into row dicts, then upsert by
(source='osm', external_id=<osm_id>) so re-runs are safe and only
OSM-sourced rows are ever touched.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_TIMEOUT_SECONDS = 120
# Overpass's Apache layer rejects httpx's default UA with 406 Not Acceptable.
# Identifying ourselves also follows the Overpass usage policy:
# https://operations.osmfoundation.org/policies/api/
USER_AGENT = "Fetchpawz/1.0 (https://fetchapp.dev; admin OSM import)"

# Row keys every importer produces; anything else in a row is an
# entity-specific extra column (e.g. vet phone/website/hours).
_BASE_KEYS = {"external_id", "name", "address", "lat", "lng", "attributes"}


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


@dataclass
class OsmImportConfig:
    """Entity-specific knobs for one OSM importer."""

    entity: str  # "park" / "vet" — used in log lines
    model: type  # SQLAlchemy model with name/address/lat/lng/attributes/source/external_id
    selectors: list[str]  # Overpass tag filters, e.g. '"leisure"="dog_park"'
    extract_attributes: Callable[[dict[str, Any]], dict[str, Any]]
    # Extra columns parsed from tags (merged into the row, applied on create;
    # on update they only overwrite when the new value is truthy).
    extract_extras: Callable[[dict[str, Any]], dict[str, Any]] = field(
        default=lambda tags: {}
    )


def _build_query(config: OsmImportConfig, bbox: tuple[float, float, float, float] | None) -> str:
    """Compose an Overpass QL query. `bbox` is (south, west, north, east).

    Each selector expands to node/way/relation filters; Overpass dedupes
    elements matching more than one, and we guard with a seen-set anyway.
    """
    if bbox:
        south, west, north, east = bbox
        bbox_clause = f"({south},{west},{north},{east})"
    else:
        bbox_clause = ""
    lines = "\n".join(
        f'      {kind}[{selector}]{bbox_clause};'
        for selector in config.selectors
        for kind in ("node", "way", "relation")
    )
    return f"""
    [out:json][timeout:{DEFAULT_TIMEOUT_SECONDS}];
    (
{lines}
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


def _parse_element(config: OsmImportConfig, elem: dict[str, Any]) -> dict[str, Any] | None:
    """Turn one OSM element into our row shape, or None if unusable."""
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
        "attributes": config.extract_attributes(tags) or None,
        **config.extract_extras(tags),
    }


async def fetch_osm_elements(
    config: OsmImportConfig,
    bbox: tuple[float, float, float, float] | None = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> list[dict[str, Any]]:
    """Query Overpass. Returns a list of parsed row dicts (one per OSM element)."""
    query = _build_query(config, bbox)
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()
        payload = resp.json()

    elements = payload.get("elements") or []
    parsed: list[dict[str, Any]] = []
    seen: set[str] = set()
    for e in elements:
        row = _parse_element(config, e)
        if row is None or row["external_id"] in seen:
            continue
        seen.add(row["external_id"])
        parsed.append(row)
    return parsed


async def import_osm_elements(
    db: AsyncSession,
    config: OsmImportConfig,
    bbox: tuple[float, float, float, float] | None = None,
) -> ImportResult:
    """Fetch from Overpass and upsert into the configured table.

    Only rows where `source='osm'` are touched — user-submitted rows are safe.
    OSM rows are marked `verified=True` on creation (OSM has moderation).
    """
    parsed = await fetch_osm_elements(config, bbox=bbox)
    if not parsed:
        return ImportResult(created=0, updated=0, total_fetched=0, errors=[])

    # Load existing OSM-sourced rows into a map keyed by external_id for
    # cheap lookup + upsert.
    existing_res = await db.execute(
        select(config.model).where(config.model.source == "osm")
    )
    by_external: dict[str, Any] = {}
    for obj in existing_res.scalars().all():
        if obj.external_id:
            by_external[obj.external_id] = obj

    created = 0
    updated = 0
    errors: list[str] = []

    for row in parsed:
        try:
            existing = by_external.get(row["external_id"])
            if existing is None:
                db.add(config.model(**row, source="osm", verified=True))
                created += 1
            else:
                # Refresh mutable fields. Don't wipe verified/created_by or
                # anything user-generated hanging off the row.
                existing.name = row["name"]
                existing.address = row["address"]
                existing.lat = row["lat"]
                existing.lng = row["lng"]
                # Only replace attributes if the import actually has some,
                # otherwise keep whatever was there.
                if row["attributes"]:
                    existing.attributes = row["attributes"]
                for key in set(row) - _BASE_KEYS:
                    setattr(existing, key, row[key] or getattr(existing, key))
                updated += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{row.get('external_id')}: {exc}")
            logger.exception(
                "%s_import_row_failed", config.entity, extra={"row": row}
            )

    await db.commit()
    logger.info(
        "%s_import_complete created=%s updated=%s total=%s errors=%s",
        config.entity, created, updated, len(parsed), len(errors),
    )
    return ImportResult(
        created=created,
        updated=updated,
        total_fetched=len(parsed),
        errors=errors[:20],  # cap to keep response size sane
    )
