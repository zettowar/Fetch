"""Regressions from the full quality pass: each test pins a defect that was
reachable from ordinary use and answered with a 500, a silent no-op, or wrong
data. Grouped by the surface a person would have hit it from."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

from app.models.pet import Pet
from app.models.user import User
from app.models.vote import Vote
from app.models.weekly_winner import WeeklyWinner
from app.services.feed_service import current_week_bucket
from tests.conftest import test_session_factory as session_factory


async def _signup(client: AsyncClient, prefix: str = "qp") -> tuple[dict, dict]:
    email = f"{prefix}-{uuid.uuid4().hex[:10]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Quality Pass",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    return {"Authorization": f"Bearer {body['tokens']['access_token']}"}, body["user"]


async def _make_pet(client: AsyncClient, headers: dict, **over) -> dict:
    payload = {"name": "Biscuit", "species": "dog", **over}
    res = await client.post("/api/v1/pets", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


# --- Pets: the editor's inputs -------------------------------------------------


@pytest.mark.asyncio
async def test_public_toggle_is_honoured_on_create(client: AsyncClient, auth_headers: dict):
    """The create form shows the "Public share page" switch; switching it off
    used to be dropped, and the pet was created public anyway."""
    pet = await _make_pet(client, auth_headers, is_public=False)
    assert pet["is_public"] is False
    assert (await client.get(f"/api/v1/public/pets/{pet['id']}")).status_code == 404


@pytest.mark.asyncio
async def test_pet_text_limits_are_422_not_500(client: AsyncClient, auth_headers: dict):
    too_long = await client.post(
        "/api/v1/pets", json={"name": "x" * 101}, headers=auth_headers
    )
    assert too_long.status_code == 422

    pet = await _make_pet(client, auth_headers)
    url = f"/api/v1/pets/{pet['id']}"
    for body in (
        {"name": "x" * 101},
        {"name": "   "},
        {"name": None},
        {"bio": "x" * 501},
        {"location_rough": "x" * 201},
        {"traits": None},
        {"is_public": None},
    ):
        res = await client.patch(url, json=body, headers=auth_headers)
        assert res.status_code == 422, (body, res.status_code, res.text)


@pytest.mark.asyncio
async def test_bio_and_birthday_can_be_cleared(client: AsyncClient, auth_headers: dict):
    pet = await _make_pet(client, auth_headers, bio="Good boy", birthday="2020-01-01")
    res = await client.patch(
        f"/api/v1/pets/{pet['id']}", json={"bio": None, "birthday": None},
        headers=auth_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["bio"] is None
    assert res.json()["birthday"] is None


@pytest.mark.asyncio
async def test_profile_name_is_validated(client: AsyncClient, auth_headers: dict):
    for name in ("   ", "x" * 101):
        res = await client.patch(
            "/api/v1/users/me", json={"display_name": name}, headers=auth_headers
        )
        assert res.status_code == 422, (name[:10], res.status_code)


# --- Blocking ------------------------------------------------------------------


@pytest.mark.asyncio
async def test_blocking_twice_is_idempotent(client: AsyncClient, auth_headers: dict):
    _, other = await _signup(client, "blockee")
    url = f"/api/v1/users/{other['id']}/block"
    assert (await client.post(url, headers=auth_headers)).status_code == 201
    # The second call used to 500: the duplicate surfaced from an autoflush
    # outside the handler that was meant to swallow it.
    assert (await client.post(url, headers=auth_headers)).status_code == 201
    blocks = (await client.get("/api/v1/users/me/blocks", headers=auth_headers)).json()
    assert [b["user_id"] for b in blocks].count(other["id"]) == 1


# --- Notification preferences ----------------------------------------------------


@pytest.mark.asyncio
async def test_notification_prefs_reject_bad_values(client: AsyncClient, auth_headers: dict):
    url = "/api/v1/notifications/preferences"
    assert (await client.patch(url, json={"digest_mode": "hourly"}, headers=auth_headers)).status_code == 422
    assert (await client.patch(url, json={"new_followers": None}, headers=auth_headers)).status_code == 422
    ok = await client.patch(url, json={"digest_mode": "weekly"}, headers=auth_headers)
    assert ok.status_code == 200 and ok.json()["digest_mode"] == "weekly"


# --- Lost & found ----------------------------------------------------------------


async def _open_report(client: AsyncClient, headers: dict) -> dict:
    res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "description": "Brown lab, red collar",
        "last_seen_lat": 43.65, "last_seen_lng": -79.38,
    }, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


@pytest.mark.asyncio
async def test_sighting_with_bad_coordinates_is_422(client: AsyncClient, auth_headers: dict):
    report = await _open_report(client, auth_headers)
    spotter, _ = await _signup(client, "spotter")
    res = await client.post(
        f"/api/v1/lost/reports/{report['id']}/sightings",
        data={"lat": "-123.1", "lng": "49.2"},  # swapped — lat is out of range
        headers=spotter,
    )
    assert res.status_code == 422, res.text
    assert "lat" in res.json()["detail"]


@pytest.mark.asyncio
async def test_sighting_tolerates_a_fast_phone_clock(client: AsyncClient, auth_headers: dict):
    """Clients send "now". A phone a little ahead of the server was told it
    had seen the pet in the future."""
    report = await _open_report(client, auth_headers)
    spotter, _ = await _signup(client, "spotter")
    url = f"/api/v1/lost/reports/{report['id']}/sightings"
    soon = (datetime.now(timezone.utc) + timedelta(seconds=90)).isoformat()
    ok = await client.post(url, data={"lat": "43.65", "lng": "-79.38", "seen_at": soon}, headers=spotter)
    assert ok.status_code == 201, ok.text
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    bad = await client.post(url, data={"lat": "43.65", "lng": "-79.38", "seen_at": tomorrow}, headers=spotter)
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_alert_radius_cannot_be_patched_below_the_floor(
    client: AsyncClient, auth_headers: dict
):
    """Alerts match on a report's TRUE location, so a subscriber who could
    shrink their radius to metres would learn it far more precisely than the
    fuzzed public point allows. Create enforced 1–100 km; PATCH did not."""
    created = await client.post("/api/v1/lost/subscriptions", json={
        "home_lat": 43.65, "home_lng": -79.38, "radius_km": 10,
    }, headers=auth_headers)
    assert created.status_code in (200, 201), created.text
    url = "/api/v1/lost/subscriptions/mine"
    for body in ({"radius_km": 0.01}, {"radius_km": 5000}, {"radius_km": None}, {"home_lat": 999}):
        res = await client.patch(url, json=body, headers=auth_headers)
        assert res.status_code == 422, (body, res.status_code, res.text)
    assert (await client.patch(url, json={"radius_km": 25}, headers=auth_headers)).status_code == 200


@pytest.mark.asyncio
async def test_closing_an_account_takes_its_lost_reports_offline(client: AsyncClient):
    headers, _ = await _signup(client, "leaver")
    report = await _open_report(client, headers)
    assert (await client.get(f"/lost/{report['id']}")).status_code == 200

    assert (await client.delete("/api/v1/users/me", headers=headers)).status_code == 200
    assert (await client.get(f"/lost/{report['id']}")).status_code == 404


@pytest.mark.asyncio
async def test_staff_closed_report_is_not_served_as_found(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """A takedown is not a reunion: the share page used to keep showing the
    report under "Good news — this pet has been found"."""
    report = await _open_report(client, auth_headers)
    closed = await client.post(
        f"/api/v1/admin/lost-reports/{report['id']}/close", headers=admin_headers
    )
    assert closed.status_code == 200
    assert (await client.get(f"/lost/{report['id']}")).status_code == 404


# --- Rankings and the crown ------------------------------------------------------


async def _vote(pet_id: str, value: int, week=None) -> None:
    """Record one vote straight in the table (a fresh voter each time)."""
    async with session_factory() as db:
        voter = User(
            email=f"voter-{uuid.uuid4().hex[:10]}@fetchapp.dev",
            password_hash="x", display_name="Voter",
        )
        db.add(voter)
        await db.flush()
        db.add(Vote(
            voter_id=voter.id, pet_id=uuid.UUID(pet_id), value=value,
            week_bucket=week or current_week_bucket(),
        ))
        await db.commit()


@pytest.mark.asyncio
async def test_winner_endpoints_survive_a_deleted_champion(
    client: AsyncClient, auth_headers: dict
):
    """weekly_winners.pet_id is SET NULL when the pet is hard-deleted. One such
    row used to 500 the rankings history (and the home screen) for everyone."""
    week = current_week_bucket() - timedelta(weeks=200)  # a week nothing else uses
    async with session_factory() as db:
        db.add(WeeklyWinner(week_bucket=week, species="dog", pet_id=None, score=3))
        await db.commit()

    res = await client.get("/api/v1/rankings/history?limit=52", headers=auth_headers)
    assert res.status_code == 200, res.text
    assert all(w["pet_id"] for w in res.json())
    assert (await client.get("/api/v1/rankings/winner/current", headers=auth_headers)).status_code == 200


@pytest.mark.asyncio
async def test_crown_needs_a_net_positive_score_and_is_cleared_when_lost(
    client: AsyncClient, auth_headers: dict
):
    from app.services.ranking_service import _pick_winner_for_week

    # Cats, in a week of their own, so other tests' dog votes can't interfere.
    week = current_week_bucket() - timedelta(weeks=300)
    pet = await _make_pet(client, auth_headers, species="cat", name="Mittens")

    async with session_factory() as db:
        # Only passes: nobody earns a crown for a score of -1.
        await _vote(pet["id"], -1, week)
        assert await _pick_winner_for_week(db, week, "cat", upsert=True) is None

    await _vote(pet["id"], 1, week)
    await _vote(pet["id"], 1, week)
    async with session_factory() as db:
        winner = await _pick_winner_for_week(db, week, "cat", upsert=True)
        assert winner is not None and str(winner.pet_id) == pet["id"]

    # The champion is deactivated and nobody else has votes: the crown must
    # come off rather than stay on a pet visitors can no longer open.
    async with session_factory() as db:
        await db.execute(update(Pet).where(Pet.id == uuid.UUID(pet["id"])).values(is_active=False))
        await db.commit()
        assert await _pick_winner_for_week(db, week, "cat", upsert=True) is None
        left = (await db.execute(
            select(WeeklyWinner).where(WeeklyWinner.week_bucket == week, WeeklyWinner.species == "cat")
        )).scalar_one_or_none()
        assert left is None


@pytest.mark.asyncio
async def test_transferred_pet_stays_in_the_game(client: AsyncClient, auth_headers: dict):
    """Accepting a rescue's transfer stamps adopted_at on a pet that now
    belongs to an ordinary member. Every eligibility query treated that as
    "adopted out" and the pet never appeared in a deck or a ranking again."""
    owner_headers, owner = await _signup(client, "adopter")
    pet = await _make_pet(client, owner_headers, name="Gotcha")
    now = datetime.now(timezone.utc)
    async with session_factory() as db:
        await db.execute(
            update(Pet).where(Pet.id == uuid.UUID(pet["id"]))
            .values(adopted_at=now, adopted_by_user_id=uuid.UUID(owner["id"]))
        )
        await db.commit()
    await _vote(pet["id"], 1)

    board = (await client.get("/api/v1/rankings/current?species=dog", headers=auth_headers)).json()
    assert pet["id"] in [e["pet_id"] for e in board]

    # A pet a rescue marked adopted (nobody adopted it *into* an account) is out.
    async with session_factory() as db:
        await db.execute(
            update(Pet).where(Pet.id == uuid.UUID(pet["id"])).values(adopted_by_user_id=None)
        )
        await db.commit()
    board = (await client.get("/api/v1/rankings/current?species=dog", headers=auth_headers)).json()
    assert pet["id"] not in [e["pet_id"] for e in board]


# --- Admin -----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rescue_accounts_cannot_be_promoted_or_demoted(
    client: AsyncClient, admin_headers: dict
):
    """Promote-then-demote left an approved rescue as a plain user with no way
    back: nothing can assign the "rescue" role again."""
    _, user = await _signup(client, "rescue-role")
    async with session_factory() as db:
        await db.execute(update(User).where(User.id == uuid.UUID(user["id"])).values(role="rescue"))
        await db.commit()
    for verb in ("promote", "demote"):
        res = await client.post(f"/api/v1/admin/users/{user['id']}/{verb}", headers=admin_headers)
        assert res.status_code == 400, (verb, res.text)
    async with session_factory() as db:
        role = (await db.execute(select(User.role).where(User.id == uuid.UUID(user["id"])))).scalar()
    assert role == "rescue"


@pytest.mark.asyncio
async def test_reinstate_revives_pets_after_a_repeat_suspension(
    client: AsyncClient, admin_headers: dict
):
    """A second suspend of an already-suspended user logged an empty pet list;
    reinstatement read only that newest entry and revived nothing."""
    headers, user = await _signup(client, "suspendee")
    pet = await _make_pet(client, headers)
    base = f"/api/v1/admin/users/{user['id']}"

    assert (await client.post(f"{base}/suspend", headers=admin_headers)).status_code == 200
    assert (await client.post(f"{base}/suspend", headers=admin_headers)).status_code == 200
    assert (await client.post(f"{base}/reinstate", headers=admin_headers)).status_code == 200

    async with session_factory() as db:
        active = (await db.execute(select(Pet.is_active).where(Pet.id == uuid.UUID(pet["id"])))).scalar()
    assert active is True


# --- News ------------------------------------------------------------------------


def test_news_links_keep_same_site_paths():
    """Two seeded posts link into the site ("/signup-rescue"). Saving an edit
    used to rewrite that to "https:///signup-rescue" and break the link."""
    from app.schemas.news import NewsPostCreate, NewsPostUpdate
    from app.schemas.urls import normalise_url

    assert NewsPostUpdate(link_url="/signup-rescue").link_url == "/signup-rescue"
    assert NewsPostCreate(title="t", body="b", link_url="/about").link_url == "/about"
    # External links still get a scheme, and a protocol-relative URL is not a path.
    assert NewsPostUpdate(link_url="example.com/x").link_url == "https://example.com/x"
    assert NewsPostUpdate(link_url="//evil.example").link_url.startswith("https://")
    # Everywhere else (rescue websites, vet sites) a path is still not a URL.
    assert normalise_url("/signup-rescue") == "https:///signup-rescue"
    with pytest.raises(ValueError):
        NewsPostUpdate(link_url="javascript:alert(1)")


# --- OpenStreetMap imports ---------------------------------------------------------


def test_osm_rows_are_fitted_to_their_columns():
    """One over-long OSM value used to fail the single commit at the end of an
    import, so the whole run 500'd with nothing saved."""
    from app.models.vet import Vet
    from app.services.osm_import import _fit_to_columns

    row = {
        "external_id": "node/1",
        "name": "n" * 300,
        "phone": "+1 780 555 0100; +1 780 555 0101; +1 780 555 0102; +1 780 555 0103",
        "website": "https://example.com/" + "x" * 600,
        "lat": 53.5, "lng": -113.5, "attributes": None,
    }
    _fit_to_columns(Vet, row)
    assert len(row["name"]) == 200
    assert row["phone"] == "+1 780 555 0100"   # the first number, not a cut-off list
    assert row["website"] is None               # a truncated URL is a broken link
    assert row["lat"] == 53.5


@pytest.mark.asyncio
async def test_overpass_outage_is_a_502_not_a_500(
    client: AsyncClient, admin_headers: dict, monkeypatch
):
    import httpx

    class _Down:
        def __init__(self, *args, **kwargs): ...
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            return None
        async def post(self, *args, **kwargs):
            raise httpx.ReadTimeout("overpass is busy")

    monkeypatch.setattr("app.services.osm_import.httpx.AsyncClient", _Down)
    for kind in ("parks", "vets"):
        res = await client.post(
            f"/api/v1/admin/{kind}/import-osm", json={"bbox": [53.4, -113.7, 53.7, -113.3]},
            headers=admin_headers,
        )
        assert res.status_code == 502, (kind, res.status_code, res.text)
        assert "try again" in res.json()["detail"]
