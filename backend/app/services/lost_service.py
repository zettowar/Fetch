import math
import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pet import Pet
from app.models.lost_report import (
    LostReport,
    LostReportSubscription,
)
from app.services.geo import bounding_box, haversine_km  # noqa: F401 (re-exported)


def fuzz_coordinate(
    lat: float, lng: float, fuzz_meters: int, *, seed: str | None = None
) -> tuple[float, float]:
    """Add jitter to coordinates within a circle of `fuzz_meters` radius.

    When `seed` is provided (e.g. the report/sighting id), the jitter is
    deterministic for that entity: repeated reads return the *same* fuzzed
    point, so a non-owner can't average many reads to triangulate the true
    location. Without a seed the jitter is random per call.
    """
    if fuzz_meters <= 0:
        return lat, lng

    rng = random.Random(seed) if seed is not None else random

    # Convert meters to approximate degrees
    meters_per_deg_lat = 111_320.0
    meters_per_deg_lng = 111_320.0 * math.cos(math.radians(lat))

    angle = rng.uniform(0, 2 * math.pi)
    distance = rng.uniform(0, fuzz_meters)

    dlat = (distance * math.cos(angle)) / meters_per_deg_lat
    dlng = (distance * math.sin(angle)) / max(meters_per_deg_lng, 1.0)

    return lat + dlat, lng + dlng


async def get_nearby_reports(
    db: AsyncSession,
    lat: float,
    lng: float,
    radius_km: float,
    kind: str | None = None,
    limit: int = 100,
) -> list[LostReport]:
    """Get open reports within radius_km of the given coordinates.

    Uses a bounding-box pre-filter then haversine for accuracy.
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
            LostReport.last_seen_lat.isnot(None),
            LostReport.last_seen_lng.isnot(None),
            LostReport.last_seen_lat.between(min_lat, max_lat),
            LostReport.last_seen_lng.between(min_lng, max_lng),
        )
    )
    if kind:
        query = query.where(LostReport.kind == kind)

    query = query.order_by(LostReport.created_at.desc()).limit(limit * 2)
    result = await db.execute(query)
    candidates = result.scalars().all()

    # Precise haversine filter
    return [
        r for r in candidates
        if haversine_km(lat, lng, r.last_seen_lat, r.last_seen_lng) <= radius_km
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
