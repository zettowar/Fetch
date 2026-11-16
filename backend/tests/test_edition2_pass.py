"""Regressions from the Edition 2 quality pass.

Each test pins a defect that was reachable from ordinary use (or from one
hand-written request) and went unnoticed because the suite only ever exercised
the adjacent, well-behaved case. Grouped by the surface it was reached from.
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import update

from app.models.user import User
from tests.conftest import test_session_factory as session_factory


async def _signup(client: AsyncClient, prefix: str = "e2") -> tuple[dict, dict]:
    email = f"{prefix}-{uuid.uuid4().hex[:10]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Edition Two",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    return {"Authorization": f"Bearer {body['tokens']['access_token']}"}, body["user"]


async def _verify(user_id: str) -> None:
    async with session_factory() as db:
        await db.execute(update(User).where(User.id == user_id).values(is_verified=True))
        await db.commit()


async def _make_pet(client: AsyncClient, headers: dict, **over) -> dict:
    res = await client.post(
        "/api/v1/pets", json={"name": "Biscuit", "species": "dog", **over}, headers=headers
    )
    assert res.status_code == 201, res.text
    return res.json()


async def _open_report(client: AsyncClient, headers: dict, **over) -> dict:
    res = await client.post("/api/v1/lost/reports", json={
        "kind": "missing", "description": "Brown lab, red collar",
        "last_seen_lat": 43.65, "last_seen_lng": -79.38, **over,
    }, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


# --- Lost & Found: who may publish what ------------------------------------------


@pytest.mark.asyncio
async def test_found_report_cannot_carry_someone_elses_pet(client: AsyncClient):
    """A found report could name any pet_id, and the public share page then
    showed that pet's name, breed and photo under the reporter's own text —
    even for a pet whose owner had opted out of public pages."""
    owner, _ = await _signup(client, "owner")
    pet = await _make_pet(client, owner, is_public=False)

    finder, finder_user = await _signup(client, "finder")
    await _verify(finder_user["id"])  # found reports need a verified account
    res = await client.post("/api/v1/lost/reports", json={
        "kind": "found", "pet_id": pet["id"], "description": "anything at all",
        "last_seen_lat": 43.65, "last_seen_lng": -79.38,
    }, headers=finder)
    assert res.status_code == 400, res.text

    # The same request without the pet is the ordinary found report.
    ok = await client.post("/api/v1/lost/reports", json={
        "kind": "found", "description": "Small grey cat, no collar",
        "last_seen_lat": 43.65, "last_seen_lng": -79.38,
    }, headers=finder)
    assert ok.status_code == 201, ok.text


@pytest.mark.asyncio
async def test_reporter_cannot_undo_a_staff_takedown(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """`closed` is terminal. The reporter of a report staff had taken down
    could call /resolve, and `resolved` is a state the share page serves."""
    report = await _open_report(client, auth_headers)
    url = f"/api/v1/lost/reports/{report['id']}"
    closed = await client.post(
        f"/api/v1/admin/lost-reports/{report['id']}/close", headers=admin_headers
    )
    assert closed.status_code == 200

    assert (await client.post(f"{url}/resolve", headers=auth_headers)).status_code == 409
    assert (await client.get(f"/lost/{report['id']}")).status_code == 404
    assert f"/lost/{report['id']}" not in (await client.get("/sitemap.xml")).text

    # Gone for other members too; still visible to the reporter and to staff.
    stranger, _ = await _signup(client, "stranger")
    assert (await client.get(url, headers=stranger)).status_code == 404
    assert (await client.get(f"{url}/sightings", headers=stranger)).status_code == 404
    mine = await client.get(url, headers=auth_headers)
    assert mine.status_code == 200 and mine.json()["status"] == "closed"
    assert (await client.get(url, headers=admin_headers)).status_code == 200


@pytest.mark.asyncio
async def test_suspension_takes_the_users_share_pages_down(
    client: AsyncClient, admin_headers: dict
):
    """Closing an account hid its reports; suspending one for abuse did not,
    so the public, indexable page stayed up with a live "report a sighting"
    button pointing at an account nobody could reach."""
    headers, user = await _signup(client, "suspended")
    report = await _open_report(client, headers)
    assert (await client.get(f"/lost/{report['id']}")).status_code == 200

    res = await client.post(f"/api/v1/admin/users/{user['id']}/suspend", headers=admin_headers)
    assert res.status_code == 200, res.text

    assert (await client.get(f"/lost/{report['id']}")).status_code == 404
    assert f"/lost/{report['id']}" not in (await client.get("/sitemap.xml")).text


# --- Blocks: where someone is going to be ----------------------------------------


@pytest.mark.asyncio
async def test_block_hides_play_dates_and_check_ins(client: AsyncClient, admin_headers: dict):
    """RSVPs honoured a block; the listings did not. Someone who had been
    blocked could still read which park the blocker was hosting at and when,
    and see their pet in a park's live check-ins."""
    from datetime import datetime, timedelta, timezone

    host, host_user = await _signup(client, "host")
    other, other_user = await _signup(client, "other")
    park = await client.post(
        "/api/v1/parks", json={"name": "Block Park", "lat": 43.6, "lng": -79.4},
        headers=admin_headers,
    )
    assert park.status_code == 201, park.text
    park_id = park.json()["id"]
    pet = await _make_pet(client, host)

    when = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
    pd = await client.post("/api/v1/playdates", json={
        "park_id": park_id, "host_pet_id": pet["id"], "scheduled_for": when, "title": "Meetup",
    }, headers=host)
    assert pd.status_code == 201, pd.text
    pd_id = pd.json()["id"]
    ci = await client.post(
        f"/api/v1/parks/{park_id}/checkin", json={"pet_id": pet["id"]}, headers=host
    )
    assert ci.status_code == 201, ci.text

    upcoming = "/api/v1/playdates/upcoming"
    params = {"park_id": park_id}

    # Before the block the other member sees both.
    assert [p["id"] for p in (await client.get(upcoming, params=params, headers=other)).json()] == [pd_id]
    assert len((await client.get(f"/api/v1/parks/{park_id}/checkins", headers=other)).json()) == 1

    # The host blocks them: both disappear, and the direct link 404s.
    blocked = await client.post(f"/api/v1/users/{other_user['id']}/block", headers=host)
    assert blocked.status_code == 201, blocked.text
    assert (await client.get(upcoming, params=params, headers=other)).json() == []
    assert (await client.get(f"/api/v1/playdates/{pd_id}", headers=other)).status_code == 404
    assert (await client.get(f"/api/v1/parks/{park_id}/checkins", headers=other)).json() == []

    # The host still sees their own.
    assert [p["id"] for p in (await client.get(upcoming, params=params, headers=host)).json()] == [pd_id]
    assert len((await client.get(f"/api/v1/parks/{park_id}/checkins", headers=host)).json()) == 1


@pytest.mark.asyncio
async def test_block_removes_the_pet_from_the_liked_list(client: AsyncClient):
    owner, owner_user = await _signup(client, "liked-owner")
    fan, fan_user = await _signup(client, "liked-fan")
    pet = await _make_pet(client, owner)
    vote = await client.post("/api/v1/votes", json={"pet_id": pet["id"], "value": 1}, headers=fan)
    assert vote.status_code == 201, vote.text
    assert [p["id"] for p in (await client.get("/api/v1/votes/liked", headers=fan)).json()] == [pet["id"]]

    await client.post(f"/api/v1/users/{fan_user['id']}/block", headers=owner)
    assert (await client.get("/api/v1/votes/liked", headers=fan)).json() == []


# --- Transfers --------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pending_transfers_are_not_listed_to_an_unverified_address(client: AsyncClient):
    """Accepting a transfer needs a verified email; reading the list did not,
    so signing up with someone else's address showed their pending transfer."""
    from datetime import datetime, timedelta, timezone

    from app.models.pet_transfer import PetTransfer

    rescue, rescue_user = await _signup(client, "xfer-rescue")
    pet = await _make_pet(client, rescue)
    adopter, adopter_user = await _signup(client, "xfer-adopter")

    async with session_factory() as db:
        db.add(PetTransfer(
            pet_id=uuid.UUID(pet["id"]), from_user_id=uuid.UUID(rescue_user["id"]),
            invited_email=adopter_user["email"], status="pending",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        ))
        await db.commit()

    assert (await client.get("/api/v1/pet-transfers/mine", headers=adopter)).json() == []
    await _verify(adopter_user["id"])
    assert len((await client.get("/api/v1/pet-transfers/mine", headers=adopter)).json()) == 1


# --- Admin PATCH: explicit null ----------------------------------------------------


@pytest.mark.asyncio
async def test_admin_patch_with_null_is_422_not_500(client: AsyncClient, admin_headers: dict):
    breed = await client.post(
        "/api/v1/admin/breeds", json={"name": f"Nullhound {uuid.uuid4().hex[:6]}"},
        headers=admin_headers,
    )
    assert breed.status_code in (200, 201), breed.text
    res = await client.patch(
        f"/api/v1/admin/breeds/{breed.json()['id']}", json={"name": None}, headers=admin_headers
    )
    assert res.status_code == 422, res.text

    trait = await client.post(
        "/api/v1/admin/pet-traits", json={"label": f"Nully {uuid.uuid4().hex[:5]}", "species": "both"},
        headers=admin_headers,
    )
    assert trait.status_code in (200, 201), trait.text
    res = await client.patch(
        f"/api/v1/admin/pet-traits/{trait.json()['id']}", json={"label": None}, headers=admin_headers
    )
    assert res.status_code == 422, res.text


# --- Donations: the pause switch ---------------------------------------------------


@pytest.mark.asyncio
async def test_pausing_donations_is_visible_to_the_client(
    client: AsyncClient, auth_headers: dict, admin_headers: dict, stripe_on
):
    """The setting promises to hide the calls to action. It only rejected the
    checkout, so every Donate button stayed up and led to a 503."""
    cfg = (await client.get("/api/v1/donations/config", headers=auth_headers)).json()
    assert cfg["enabled"] is True and cfg["paused"] is False

    put = await client.put(
        "/api/v1/admin/settings/donations_paused", json={"value": True}, headers=admin_headers
    )
    assert put.status_code == 200, put.text
    try:
        cfg = (await client.get("/api/v1/donations/config", headers=auth_headers)).json()
        assert cfg["enabled"] is False and cfg["paused"] is True
    finally:
        await client.put(
            "/api/v1/admin/settings/donations_paused", json={"value": False}, headers=admin_headers
        )


# --- Email -------------------------------------------------------------------------


def test_announcement_body_is_text_and_keeps_its_paragraphs():
    from app.services.email import text_to_html

    out = text_to_html("Parks open <today> & tomorrow.\nBring water.\n\nSee you there.")
    assert out == (
        "<p>Parks open &lt;today&gt; &amp; tomorrow.<br>Bring water.</p>"
        "<p>See you there.</p>"
    )


def test_unsubscribe_line_sits_below_the_button():
    from app.services.email import _layout

    page = _layout(
        "Heading", "<p>Body</p>", cta_url="https://example.test/x", cta_label="Open",
        after_cta="<p>UNSUB-MARKER</p>",
    )
    assert page.index("Body") < page.index(">Open<") < page.index("UNSUB-MARKER")


def test_base_url_setting_drops_a_trailing_slash():
    from app.config import Settings

    s = Settings(FRONTEND_BASE_URL="https://fetchpawz.test/", _env_file=None)
    assert s.FRONTEND_BASE_URL == "https://fetchpawz.test"


# --- Image pipeline ----------------------------------------------------------------


def _process(data: bytes):
    from app.services.image_processing import process_image

    return process_image(
        data, max_dim=1600, max_pixels=30_000_000,
        allowed_types={"image/jpeg", "image/png", "image/webp"},
    )


def _jpeg_bytes(**save) -> bytes:
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (64, 48), "orange").save(buf, format="JPEG", **save)
    return buf.getvalue()


def test_jpeg_comment_does_not_survive_processing():
    import io

    from PIL import Image

    src = _jpeg_bytes(comment=b"shot at 12 Example Street")
    assert Image.open(io.BytesIO(src)).info.get("comment")
    out = _process(src)
    assert b"Example Street" not in out.data
    assert not Image.open(io.BytesIO(out.data)).info.get("comment")


def test_multi_picture_jpeg_is_accepted_as_a_jpeg():
    import io

    from PIL import Image

    first = Image.new("RGB", (64, 48), "orange")
    buf = io.BytesIO()
    first.save(buf, format="MPO", save_all=True, append_images=[Image.new("RGB", (64, 48), "navy")])
    assert Image.open(io.BytesIO(buf.getvalue())).format == "MPO"

    out = _process(buf.getvalue())
    assert out.content_type == "image/jpeg"
    assert Image.open(io.BytesIO(out.data)).format == "JPEG"
    assert (out.width, out.height) == (64, 48)


# --- QR tags -----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tag_lookup_says_whether_the_owner_can_be_reached(
    client: AsyncClient, admin_headers: dict
):
    """A hidden pet's owner can still be messaged; a deactivated pet's cannot.
    Both came back as `assigned, no pet`, and the page promised the relay for
    both — the second answered the finder's message with "Unknown tag"."""
    owner, _ = await _signup(client, "tag-owner")
    pet = await _make_pet(client, owner, is_public=False)
    minted = await client.post(
        "/api/v1/admin/tags/generate", json={"count": 1}, headers=admin_headers
    )
    assert minted.status_code in (200, 201), minted.text
    body = minted.json()
    codes = body["codes"] if isinstance(body, dict) else body
    code = codes[0]["code"] if isinstance(codes[0], dict) else codes[0]
    linked = await client.post(
        "/api/v1/tags/claim", json={"code": code, "pet_id": pet["id"]}, headers=owner
    )
    assert linked.status_code in (200, 201), linked.text

    hidden = (await client.get(f"/api/v1/public/tags/{code}")).json()
    assert hidden == {"assigned": True, "pet": None, "contactable": True}

    assert (await client.delete(f"/api/v1/pets/{pet['id']}", headers=owner)).status_code == 200
    after = (await client.get(f"/api/v1/public/tags/{code}")).json()
    assert after["pet"] is None and after["contactable"] is False
