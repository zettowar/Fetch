"""Backfill rescue coordinates so the Rescue map has real pins to render.

Ensures at least 10 approved demo rescues in Winnipeg and 10 in Edmonton,
plus a scatter of well-known rescue cities across North America. Any
existing rescue profile missing lat/lng is also assigned a scattered
location so it shows up on the map.

Run inside the backend container:
    docker compose exec backend python -m app.scripts.backfill_rescue_locations
"""
from __future__ import annotations

import asyncio
import random
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import async_session
from app.models.rescue import RescueProfile
from app.models.user import User
from app.security import hash_password


# Slugified email + display data, deterministic so re-runs are idempotent.
WINNIPEG_CENTER = (49.8951, -97.1384)
EDMONTON_CENTER = (53.5461, -113.4938)

WINNIPEG_RESCUES = [
    "Manitoba Mutts Rescue",
    "Hull's Haven Border Collie Rescue",
    "Pet Refuge Winnipeg",
    "Big Sky K9 Rescue",
    "D'Arcy's ARC",
    "Funds for Furry Friends",
    "Forks Animal Aid",
    "Prairie Paws Winnipeg",
    "Red River Rescue",
    "Winnipeg Lost Pet Alert",
]

EDMONTON_RESCUES = [
    "Edmonton Animal Rescue Society",
    "SAINTS Rescue Edmonton",
    "Whiskers and Wags Edmonton",
    "Pawsitive Match Rescue",
    "Last Chance Animal Rescue",
    "Mountain View Animal Rescue",
    "River Valley Pet Rescue",
    "Alberta Canine Connection",
    "YEG Pets Rescue",
    "Wildrose Animal Rescue",
]

# (org_name, city_label, lat, lng) — well-known cities across NA.
SCATTERED_RESCUES = [
    ("Toronto Animal Services",    "Toronto, ON",       43.6532,  -79.3832),
    ("Vancouver Animal Rescue",    "Vancouver, BC",     49.2827, -123.1207),
    ("Calgary Humane Society",     "Calgary, AB",       51.0447, -114.0719),
    ("Montreal SPCA",              "Montreal, QC",      45.5017,  -73.5673),
    ("Ottawa Pet Rescue",          "Ottawa, ON",        45.4215,  -75.6972),
    ("Halifax Tails Rescue",       "Halifax, NS",       44.6488,  -63.5752),
    ("Seattle Humane",             "Seattle, WA",       47.6062, -122.3321),
    ("Chicago Canine Rescue",      "Chicago, IL",       41.8781,  -87.6298),
    ("Denver Dumb Friends League", "Denver, CO",        39.7392, -104.9903),
    ("Miami Mutts Rescue",         "Miami, FL",         25.7617,  -80.1918),
]


def _jitter(center: tuple[float, float], km: float = 6.0, rng: random.Random | None = None) -> tuple[float, float]:
    """Random point within ~`km` of `center`. Crude but fine for demo pins."""
    rng = rng or random
    deg_per_km = 1.0 / 111.32
    dlat = rng.uniform(-1, 1) * km * deg_per_km
    dlng = rng.uniform(-1, 1) * km * deg_per_km
    return (center[0] + dlat, center[1] + dlng)


def _email_for(org: str, suffix: str) -> str:
    slug = (
        org.lower()
        .replace("'", "")
        .replace(".", "")
        .replace(",", "")
        .replace("&", "and")
    )
    slug = "-".join(slug.split())
    return f"{slug}-{suffix}@fetchapp.test"


async def _ensure_rescue(
    session: AsyncSession,
    *,
    email: str,
    org_name: str,
    description: str,
    location: str,
    lat: float,
    lng: float,
    reviewer_id: uuid.UUID | None,
) -> str:
    """Create or update a single rescue. Returns "created"/"updated"/"skipped"."""
    existing_user_res = await session.execute(select(User).where(User.email == email))
    user = existing_user_res.scalar_one_or_none()
    if user is None:
        user = User(
            id=uuid.uuid4(),
            email=email,
            password_hash=hash_password("password123"),
            display_name=org_name,
            location_rough=location,
            role="rescue",
            is_active=True,
            is_verified=True,
        )
        session.add(user)
        await session.flush()

    profile_res = await session.execute(
        select(RescueProfile).where(RescueProfile.user_id == user.id)
    )
    profile = profile_res.scalar_one_or_none()
    if profile is None:
        session.add(RescueProfile(
            id=uuid.uuid4(),
            user_id=user.id,
            org_name=org_name,
            description=description,
            location=location,
            lat=lat,
            lng=lng,
            status="approved",
            reviewed_by=reviewer_id,
            reviewed_at=datetime.now(timezone.utc),
        ))
        return "created"

    changed = False
    if profile.lat is None or profile.lng is None:
        profile.lat = lat
        profile.lng = lng
        changed = True
    if not profile.location:
        profile.location = location
        changed = True
    return "updated" if changed else "skipped"


async def run() -> None:
    rng = random.Random(20260518)  # deterministic jitter

    async with async_session() as session:
        # Find an admin to mark as the reviewer (any admin will do; OK if None).
        admin_res = await session.execute(
            select(User).where(User.role == "admin").limit(1)
        )
        admin = admin_res.scalar_one_or_none()
        reviewer_id = admin.id if admin else None

        created = updated = skipped = 0

        # --- Winnipeg cluster ---
        for org in WINNIPEG_RESCUES:
            lat, lng = _jitter(WINNIPEG_CENTER, km=6.0, rng=rng)
            result = await _ensure_rescue(
                session,
                email=_email_for(org, "wpg"),
                org_name=org,
                description=f"{org} — community rescue serving Winnipeg and surrounding Manitoba.",
                location="Winnipeg, MB",
                lat=lat,
                lng=lng,
                reviewer_id=reviewer_id,
            )
            created += result == "created"
            updated += result == "updated"
            skipped += result == "skipped"

        # --- Edmonton cluster ---
        for org in EDMONTON_RESCUES:
            lat, lng = _jitter(EDMONTON_CENTER, km=6.0, rng=rng)
            result = await _ensure_rescue(
                session,
                email=_email_for(org, "yeg"),
                org_name=org,
                description=f"{org} — Alberta rescue rehoming pets across the Edmonton region.",
                location="Edmonton, AB",
                lat=lat,
                lng=lng,
                reviewer_id=reviewer_id,
            )
            created += result == "created"
            updated += result == "updated"
            skipped += result == "skipped"

        # --- Scattered cities ---
        for org, label, lat, lng in SCATTERED_RESCUES:
            jlat, jlng = _jitter((lat, lng), km=3.0, rng=rng)
            result = await _ensure_rescue(
                session,
                email=_email_for(org, "na"),
                org_name=org,
                description=f"{org} — local rescue based in {label}.",
                location=label,
                lat=jlat,
                lng=jlng,
                reviewer_id=reviewer_id,
            )
            created += result == "created"
            updated += result == "updated"
            skipped += result == "skipped"

        # --- Backfill any other rescue that still lacks coords. ---
        # Re-use the scattered city list as a pool so they end up visible.
        orphan_res = await session.execute(
            select(RescueProfile).where(
                (RescueProfile.lat.is_(None)) | (RescueProfile.lng.is_(None))
            )
        )
        scatter_pool = [(c[2], c[3], c[1]) for c in SCATTERED_RESCUES]
        for profile in orphan_res.scalars().all():
            lat, lng, label = rng.choice(scatter_pool)
            jlat, jlng = _jitter((lat, lng), km=8.0, rng=rng)
            profile.lat = jlat
            profile.lng = jlng
            if not profile.location:
                profile.location = label
            updated += 1

        await session.commit()
        print(
            f"Backfill complete — created: {created}, updated: {updated}, "
            f"already-had-coords (skipped): {skipped}."
        )


if __name__ == "__main__":
    asyncio.run(run())
