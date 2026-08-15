"""Regression tests for the defects found in the August 2026 codebase audit.

Each test here failed before its fix. Grouped by the finding it pins down so a
future change that reintroduces one is obvious from the test name.
"""
import uuid
from datetime import timedelta

import pytest
from httpx import AsyncClient

from app.models.pet import Pet
from app.models.user import User
from app.models.vote import Vote
from app.models.weekly_winner import WeeklyWinner
from app.services.ranking_service import current_week_bucket


# --------------------------------------------------------------------------
# "This Week's Top Dog" served a stale crown from any previous week.
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_current_winner_ignores_previous_weeks(
    client: AsyncClient, auth_headers: dict, db_session
):
    """A winner from an earlier week must not be served as the current one."""
    pet = Pet(
        id=uuid.uuid4(), owner_id=uuid.uuid4(), name="Stale", species="dog",
        is_active=True,
    )
    # Owner must exist for the FK; reuse a throwaway user.
    owner = User(id=pet.owner_id, email=f"stale-{uuid.uuid4()}@t.dev",
                 password_hash="x", display_name="T", is_active=True)
    db_session.add_all([owner, pet])
    await db_session.flush()

    db_session.add(
        WeeklyWinner(
            week_bucket=current_week_bucket() - timedelta(days=7),
            species="dog",
            pet_id=pet.id,
            score=3,
        )
    )
    await db_session.commit()

    res = await client.get(
        "/api/v1/rankings/winner/current", params={"species": "dog"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    # No winner for the week in progress -> null, so the client's
    # "No winner yet" state can actually render.
    assert res.json() is None


@pytest.mark.asyncio
async def test_current_winner_returns_this_weeks_row(
    client: AsyncClient, auth_headers: dict, db_session
):
    owner = User(id=uuid.uuid4(), email=f"cur-{uuid.uuid4()}@t.dev",
                 password_hash="x", display_name="T", is_active=True)
    pet = Pet(id=uuid.uuid4(), owner_id=owner.id, name="Current",
              species="dog", is_active=True)
    db_session.add_all([owner, pet])
    await db_session.flush()
    db_session.add(
        WeeklyWinner(week_bucket=current_week_bucket(), species="dog",
                     pet_id=pet.id, score=5)
    )
    await db_session.commit()

    res = await client.get(
        "/api/v1/rankings/winner/current", params={"species": "dog"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.json()["pet_name"] == "Current"


# --------------------------------------------------------------------------
# Suspended / adopted pets kept ranking and could still be crowned.
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_leaderboard_excludes_inactive_pets(db_session):
    from app.services.ranking_service import get_current_leaderboard

    owner = User(id=uuid.uuid4(), email=f"lb-{uuid.uuid4()}@t.dev",
                 password_hash="x", display_name="T", is_active=True)
    voter = User(id=uuid.uuid4(), email=f"lbv-{uuid.uuid4()}@t.dev",
                 password_hash="x", display_name="T", is_active=True)
    live = Pet(id=uuid.uuid4(), owner_id=owner.id, name="Live",
               species="dog", is_active=True)
    suspended = Pet(id=uuid.uuid4(), owner_id=owner.id, name="Suspended",
                    species="dog", is_active=False)
    db_session.add_all([owner, voter, live, suspended])
    await db_session.flush()

    week = current_week_bucket()
    # The suspended pet outscores the live one, so if it is not filtered it
    # would sit at the top of the board.
    db_session.add_all([
        Vote(voter_id=voter.id, pet_id=live.id, value=1, week_bucket=week),
        Vote(voter_id=voter.id, pet_id=suspended.id, value=1, week_bucket=week),
        Vote(voter_id=owner.id, pet_id=suspended.id, value=1, week_bucket=week),
    ])
    await db_session.commit()

    board = await get_current_leaderboard(db_session, species="dog")
    names = [row["pet_name"] for row in board]
    assert "Suspended" not in names
    assert "Live" in names


@pytest.mark.asyncio
async def test_weekly_winner_skips_inactive_pet(db_session):
    from app.services.ranking_service import pick_current_winner

    owner = User(id=uuid.uuid4(), email=f"w-{uuid.uuid4()}@t.dev",
                 password_hash="x", display_name="T", is_active=True)
    voter = User(id=uuid.uuid4(), email=f"wv-{uuid.uuid4()}@t.dev",
                 password_hash="x", display_name="T", is_active=True)
    banned = Pet(id=uuid.uuid4(), owner_id=owner.id, name="Banned",
                 species="dog", is_active=False)
    db_session.add_all([owner, voter, banned])
    await db_session.flush()
    db_session.add(
        Vote(voter_id=voter.id, pet_id=banned.id, value=1,
             week_bucket=current_week_bucket())
    )
    await db_session.commit()

    winners = await pick_current_winner(db_session)
    assert all(w.pet_id != banned.id for w in winners)


# --------------------------------------------------------------------------
# Staff could suspend each other (and themselves).
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_admin_cannot_suspend_self(
    client: AsyncClient, admin_headers: dict, db_session
):
    me = await client.get("/api/v1/users/me", headers=admin_headers)
    my_id = me.json()["id"]
    res = await client.post(
        f"/api/v1/admin/users/{my_id}/suspend", headers=admin_headers
    )
    assert res.status_code == 400
    assert "own account" in res.json()["detail"]


@pytest.mark.asyncio
async def test_staff_cannot_suspend_another_admin(
    client: AsyncClient, admin_headers: dict, db_session
):
    other = User(
        id=uuid.uuid4(), email=f"admin2-{uuid.uuid4()}@t.dev",
        password_hash="x", display_name="Admin Two", is_active=True, role="admin",
    )
    db_session.add(other)
    await db_session.commit()

    res = await client.post(
        f"/api/v1/admin/users/{other.id}/suspend", headers=admin_headers
    )
    assert res.status_code == 400

    await db_session.refresh(other)
    assert other.is_active is True


# --------------------------------------------------------------------------
# Photos were served with no cache validators.
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_photo_file_sets_cache_headers_and_revalidates(
    client: AsyncClient, auth_headers: dict
):
    """The public photo route must be cacheable and answer 304 on revalidation."""
    pet = await client.post(
        "/api/v1/pets",
        json={"name": "Cachey", "species": "dog"},
        headers=auth_headers,
    )
    pet_id = pet.json()["id"]

    import io
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (40, 40), (10, 120, 200)).save(buf, format="JPEG")
    buf.seek(0)
    up = await client.post(
        f"/api/v1/pets/{pet_id}/photos",
        files={"file": ("p.jpg", buf, "image/jpeg")},
        headers=auth_headers,
    )
    assert up.status_code == 201
    key = up.json()["storage_key"]

    res = await client.get(f"/api/v1/photos/file/{key}")
    assert res.status_code == 200
    assert "max-age" in res.headers["cache-control"]
    assert res.headers["cache-control"].startswith("public")
    etag = res.headers["etag"]
    assert etag

    again = await client.get(
        f"/api/v1/photos/file/{key}", headers={"If-None-Match": etag}
    )
    assert again.status_code == 304
    assert again.content == b""


# --------------------------------------------------------------------------
# Link fields rendered into href had no scheme validation.
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad", ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<b>"]
)
def test_url_normaliser_rejects_executable_schemes(bad):
    from app.schemas.urls import normalise_url

    with pytest.raises(ValueError):
        normalise_url(bad)


def test_url_normaliser_defaults_to_https():
    from app.schemas.urls import normalise_url

    assert normalise_url("example.com") == "https://example.com"
    assert normalise_url("http://a.io") == "http://a.io"
    assert normalise_url("   ") is None
    assert normalise_url(None) is None


# --------------------------------------------------------------------------
# One park review per author (the rating average was skewable).
# --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_second_park_review_updates_instead_of_stacking(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    park = await client.post(
        "/api/v1/parks",
        json={"name": "Dedupe Park", "lat": 43.65, "lng": -79.38},
        headers=admin_headers,
    )
    assert park.status_code in (200, 201)
    park_id = park.json()["id"]

    first = await client.post(
        f"/api/v1/parks/{park_id}/reviews",
        json={"rating": 5, "body": "great"}, headers=auth_headers,
    )
    assert first.status_code in (200, 201)

    second = await client.post(
        f"/api/v1/parks/{park_id}/reviews",
        json={"rating": 1, "body": "changed my mind"}, headers=auth_headers,
    )
    assert second.status_code in (200, 201)

    listed = await client.get(
        f"/api/v1/parks/{park_id}/reviews", headers=auth_headers
    )
    reviews = listed.json()
    assert len(reviews) == 1, "a re-review must replace, not stack"
    assert reviews[0]["rating"] == 1
