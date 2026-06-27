"""Shared geospatial helpers for nearby/distance queries."""
import math

KM_PER_DEG_LAT = 111.32


def bounding_box(
    lat: float, lng: float, radius_km: float
) -> tuple[float, float, float, float]:
    """Return (min_lat, max_lat, min_lng, max_lng) around a point.

    A cheap rectangular pre-filter for "nearby" SQL queries. Longitude degrees
    shrink toward the poles, so the lng span is widened by 1/cos(lat). Pair with
    :func:`haversine_km` for a precise post-filter when accuracy matters.
    """
    deg_per_km = 1.0 / KM_PER_DEG_LAT
    dlat = radius_km * deg_per_km
    dlng = radius_km * deg_per_km / max(math.cos(math.radians(lat)), 0.01)
    return lat - dlat, lat + dlat, lng - dlng, lng + dlng


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points in kilometers."""
    R = 6371.0
    rlat1, rlng1, rlat2, rlng2 = map(math.radians, [lat1, lng1, lat2, lng2])
    dlat = rlat2 - rlat1
    dlng = rlng2 - rlng1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))
