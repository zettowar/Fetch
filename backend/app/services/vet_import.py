"""Import veterinary clinics from OpenStreetMap via the Overpass API.

OSM tags `amenity=veterinary` cover most clinics; `healthcare=veterinary`
catches a few extras tagged with the newer healthcare schema. We pull
nodes, ways, and relations and upsert by (source='osm', external_id=
<osm_id>) so re-runs are safe.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vet import Vet

logger = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DEFAULT_TIMEOUT_SECONDS = 120
# Overpass's Apache layer rejects httpx's default UA with 406 Not Acceptable.
USER_AGENT = "Fetch/1.0 (https://fetchapp.dev; admin vet import)"


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
    # We union both tagging schemas to maximize coverage. Overpass dedupes
    # elements that match more than one filter, so we don't double-count.
    return f"""
    [out:json][timeout:{DEFAULT_TIMEOUT_SECONDS}];
    (
      node["amenity"="veterinary"]{bbox_clause};
      way["amenity"="veterinary"]{bbox_clause};
      relation["amenity"="veterinary"]{bbox_clause};
      node["healthcare"="veterinary"]{bbox_clause};
      way["healthcare"="veterinary"]{bbox_clause};
      relation["healthcare"="veterinary"]{bbox_clause};
    );
    out center tags;
    """.strip()


def _extract_address(tags: dict[str, Any]) -> str | None:
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
    return tags.get("loc_name") or tags.get("locality") or None


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


def _parse_element(elem: dict[str, Any]) -> dict[str, Any] | None:
    tags = elem.get("tags") or {}
    name = tags.get("name") or tags.get("official_name") or tags.get("alt_name")
    if not name:
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
        "phone": (tags.get("phone") or tags.get("contact:phone") or None),
        "website": (tags.get("website") or tags.get("contact:website") or None),
        "hours": tags.get("opening_hours"),
        "attributes": _extract_attributes(tags) or None,
    }


async def fetch_osm_vets(
    bbox: tuple[float, float, float, float] | None = None,
    timeout: int = DEFAULT_TIMEOUT_SECONDS,
) -> list[dict[str, Any]]:
    query = _build_query(bbox)
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=timeout, headers=headers) as client:
        resp = await client.post(OVERPASS_URL, data={"data": query})
        resp.raise_for_status()
        payload = resp.json()

    elements = payload.get("elements") or []
    parsed: list[dict[str, Any]] = []
    seen: set[str] = set()
    for e in elements:
        row = _parse_element(e)
        if row is None:
            continue
        # Overpass shouldn't dupe, but the union of two filters could in
        # theory return the same element twice; guard with seen-set.
        if row["external_id"] in seen:
            continue
        seen.add(row["external_id"])
        parsed.append(row)
    return parsed


async def import_osm_vets(
    db: AsyncSession,
    bbox: tuple[float, float, float, float] | None = None,
) -> ImportResult:
    """Fetch from Overpass and upsert into our `vets` table.

    Only rows where `source='osm'` are touched — user-submitted rows are safe.
    OSM rows are marked `verified=True` on creation."""
    parsed = await fetch_osm_vets(bbox=bbox)
    if not parsed:
        return ImportResult(created=0, updated=0, total_fetched=0, errors=[])

    existing_res = await db.execute(select(Vet).where(Vet.source == "osm"))
    by_external: dict[str, Vet] = {}
    for v in existing_res.scalars().all():
        if v.external_id:
            by_external[v.external_id] = v

    created = 0
    updated = 0
    errors: list[str] = []

    for row in parsed:
        try:
            existing = by_external.get(row["external_id"])
            if existing is None:
                vet = Vet(
                    name=row["name"],
                    address=row["address"],
                    lat=row["lat"],
                    lng=row["lng"],
                    phone=row["phone"],
                    website=row["website"],
                    hours=row["hours"],
                    attributes=row["attributes"],
                    source="osm",
                    external_id=row["external_id"],
                    verified=True,
                )
                db.add(vet)
                created += 1
            else:
                existing.name = row["name"]
                existing.address = row["address"]
                existing.lat = row["lat"]
                existing.lng = row["lng"]
                existing.phone = row["phone"] or existing.phone
                existing.website = row["website"] or existing.website
                existing.hours = row["hours"] or existing.hours
                if row["attributes"]:
                    existing.attributes = row["attributes"]
                updated += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{row.get('external_id')}: {exc}")
            logger.exception("vet_import_row_failed", extra={"row": row})

    await db.commit()
    logger.info(
        "vet_import_complete created=%s updated=%s total=%s errors=%s",
        created, updated, len(parsed), len(errors),
    )
    return ImportResult(
        created=created,
        updated=updated,
        total_fetched=len(parsed),
        errors=errors[:20],
    )
