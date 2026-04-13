import math
import random
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dog import Dog
from app.models.lost_report import (
    LostReport,
    LostReportSighting,
    LostReportSubscription,
)


def fuzz_coordinate(lat: float, lng: float, fuzz_meters: int) -> tuple[float, float]:
    """Add random jitter to coordinates within a circle of `fuzz_meters` radius.

    Uses a uniform random point inside a circle so repeated reads
    don't triangulate the true location.
    """
    if fuzz_meters <= 0:
        return lat, lng

    # Convert meters to approximate degrees
    meters_per_deg_lat = 111_320.0
    meters_per_deg_lng = 111_320.0 * math.cos(math.radians(lat))

    angle = random.uniform(0, 2 * math.pi)
    distance = random.uniform(0, fuzz_meters)

    dlat = (distance * math.cos(angle)) / meters_per_deg_lat
    dlng = (distance * math.sin(angle)) / max(meters_per_deg_lng, 1.0)

    return lat + dlat, lng + dlng


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points in kilometers."""
    R = 6371.0
    rlat1, rlng1, rlat2, rlng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat = rlat2 - rlat1
    dlng = rlng2 - rlng1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


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
    deg_per_km = 1.0 / 111.32
    dlat = radius_km * deg_per_km
    dlng = radius_km * deg_per_km / max(math.cos(math.radians(lat)), 0.01)

    query = (
        select(LostReport)
        .options(
            selectinload(LostReport.photos),
            selectinload(LostReport.dog).selectinload(Dog.photos),
        )
        .where(
            LostReport.status == "open",
            LostReport.last_seen_lat.isnot(None),
            LostReport.last_seen_lng.isnot(None),
            LostReport.last_seen_lat.between(lat - dlat, lat + dlat),
            LostReport.last_seen_lng.between(lng - dlng, lng + dlng),
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
