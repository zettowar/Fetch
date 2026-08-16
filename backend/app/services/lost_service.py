import math
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pet import Pet
from app.models.lost_report import (
    LostReport,
    LostReportSubscription,
)
from app.services.geo import bounding_box, haversine_km  # noqa: F401 (re-exported)


def _offset_point(lat: float, lng: float, fuzz_meters: int) -> tuple[float, float]:
    """One random point within `fuzz_meters` of (lat, lng), using a CSPRNG.

    `secrets`, not `random`: this offset is the only thing standing between a
    public share page and a missing pet's real last-seen location, which is
    usually the owner's front door.
    """
    if fuzz_meters <= 0:
        return lat, lng

    meters_per_deg_lat = 111_320.0
    meters_per_deg_lng = 111_320.0 * math.cos(math.radians(lat))

    # secrets.randbelow gives uniform integers; scale to the ranges we want.
    angle = (secrets.randbelow(10**9) / 10**9) * 2 * math.pi
    # sqrt keeps the draw uniform over the DISC rather than clustering at the
    # centre, so the true point is not the most likely guess.
    distance = fuzz_meters * math.sqrt(secrets.randbelow(10**9) / 10**9)

    dlat = (distance * math.cos(angle)) / meters_per_deg_lat
    dlng = (distance * math.sin(angle)) / max(meters_per_deg_lng, 1.0)
    return lat + dlat, lng + dlng


def public_point(
    true_lat: float | None,
    true_lng: float | None,
    fuzz_meters: int,
    *,
    current_public: tuple[float | None, float | None] = (None, None),
) -> tuple[float | None, float | None]:
    """The coordinates non-owners may see, generated once and then kept.

    Returns the existing public point unchanged whenever it is still honest —
    that is, still inside the radius the UI claims. Regenerating on every read
    (or on every settings change) is what leaks: two published points for one
    true point give simultaneous equations that solve for the true point, and
    the person who triggers that is the owner *raising* their fuzz radius to get
    more privacy.

    So it is regenerated in exactly two cases: there is no point yet, or the
    stored one now sits outside a radius the owner has REDUCED — where keeping
    it would make the "within ~N m" label on the share page a lie.
    """
    if true_lat is None or true_lng is None:
        return None, None

    cur_lat, cur_lng = current_public
    if cur_lat is not None and cur_lng is not None:
        offset_km = haversine_km(true_lat, true_lng, cur_lat, cur_lng)
        if offset_km * 1000.0 <= fuzz_meters:
            return cur_lat, cur_lng

    return _offset_point(true_lat, true_lng, fuzz_meters)


def apply_public_point(entity, true_lat, true_lng, fuzz_meters: int) -> None:
    """Set entity.public_lat/public_lng from its true coordinates, in place."""
    entity.public_lat, entity.public_lng = public_point(
        true_lat,
        true_lng,
        fuzz_meters,
        current_public=(entity.public_lat, entity.public_lng),
    )


async def get_nearby_reports(
    db: AsyncSession,
    lat: float,
    lng: float,
    radius_km: float,
    kind: str | None = None,
    limit: int = 100,
) -> list[LostReport]:
    """Open reports whose PUBLIC point is within radius_km of the coordinates.

    Filtering on the public point rather than the true one is a privacy
    requirement, not a detail. Any caller can choose the centre and radius, so
    filtering on `last_seen_lat/lng` turned this into an oracle for "is the true
    point inside this circle?" — bisect along three bearings and the exact
    stored coordinates fall out by trilateration, defeating the published fuzz
    entirely and without ever loading the share page.

    Matching on the same point we are willing to display means the endpoint can
    only ever confirm what the caller could already see.
    """
    # Bounding box (rough filter, generous)
    min_lat, max_lat, min_lng, max_lng = bounding_box(lat, lng, radius_km)

    query = (
        select(LostReport)
        .options(
            selectinload(LostReport.photos),
            selectinload(LostReport.pet).selectinload(Pet.photos),
            selectinload(LostReport.pet).selectinload(Pet.breeds),
        )
        .where(
            LostReport.status == "open",
            LostReport.public_lat.isnot(None),
            LostReport.public_lng.isnot(None),
            LostReport.public_lat.between(min_lat, max_lat),
            LostReport.public_lng.between(min_lng, max_lng),
        )
    )
    if kind:
        query = query.where(LostReport.kind == kind)

    query = query.order_by(LostReport.created_at.desc()).limit(limit * 2)
    result = await db.execute(query)
    candidates = result.scalars().all()

    # Precise haversine filter, again on the public point.
    return [
        r for r in candidates
        if haversine_km(lat, lng, r.public_lat, r.public_lng) <= radius_km
    ][:limit]


async def get_matching_subscribers(
    db: AsyncSession,
    lat: float,
    lng: float,
) -> list[LostReportSubscription]:
    """Find subscribers whose alert radius includes the given point."""
    # Generous bounding box (max 100km radius)
    max_radius_km = 100
    deg_per_km = 1.0 / 111.32
    dlat = max_radius_km * deg_per_km
    dlng = max_radius_km * deg_per_km / max(math.cos(math.radians(lat)), 0.01)

    query = select(LostReportSubscription).where(
        LostReportSubscription.enabled == True,
        LostReportSubscription.home_lat.between(lat - dlat, lat + dlat),
        LostReportSubscription.home_lng.between(lng - dlng, lng + dlng),
    )
    result = await db.execute(query)
    candidates = result.scalars().all()

    return [
        s for s in candidates
        if haversine_km(lat, lng, s.home_lat, s.home_lng) <= s.radius_km
    ]
