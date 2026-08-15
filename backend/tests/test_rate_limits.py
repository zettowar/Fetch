"""Rate limiting was never exercised anywhere.

conftest disables the limiter for the whole suite and CI sets
RATE_LIMIT_ENABLED=false, so none of the ~40 @limiter.limit rules had any
coverage — a typo'd limit string ("5/minutes", "5 per minute") would sail
through every test and only surface as a 500 in production, or worse, as a
silently absent limit on a login endpoint.

These use the `rate_limits_on` fixture to switch it back on for one test.
"""
import uuid

import pytest
from httpx import AsyncClient

from app.limiter import limiter


@pytest.mark.asyncio
async def test_every_configured_limit_string_parses(rate_limits_on):
    """The cheap, broad guard: walk every registered rule and parse it.

    Catches a malformed limit on any endpoint, including ones with no
    behavioural test below.
    """
    from app.main import app  # noqa: F401  (importing registers the routes)

    checked = 0
    for name, limits in limiter._route_limits.items():
        for lim in limits:
            # A malformed string never becomes a Limit with a parsed amount,
            # so this is what proves each decorator's argument was understood.
            assert lim.limit is not None, name
            assert lim.limit.amount > 0, name
            assert lim.limit.GRANULARITY.seconds > 0, name
            checked += 1

    # Guards the guard: if the internals move, this must fail loudly rather
    # than silently check nothing.
    assert checked >= 40, f"only {checked} rules found — did the API change?"


@pytest.mark.asyncio
async def test_login_is_limited(client: AsyncClient, rate_limits_on):
    """Brute-force protection on the most attacked endpoint in the app."""
    body = {"email": "nobody@fetchapp.dev", "password": "wrong-password"}

    statuses = [
        (await client.post("/api/v1/auth/login", json=body)).status_code
        for _ in range(8)
    ]
    # The rule is 5/minute: the first few fail auth, then the limiter takes over.
    assert 429 in statuses, statuses
    assert statuses.index(429) >= 5, f"limited too early: {statuses}"


@pytest.mark.asyncio
async def test_limit_response_is_a_429_not_a_500(client: AsyncClient, rate_limits_on):
    """slowapi needs its exception handler wired or the limit raises a 500."""
    body = {"email": "nobody@fetchapp.dev", "password": "wrong-password"}
    last = None
    for _ in range(10):
        last = await client.post("/api/v1/auth/login", json=body)
    assert last.status_code == 429
    # The SPA surfaces this text, so it must be a normal JSON error body.
    assert last.headers["content-type"].startswith("application/json")


@pytest.mark.asyncio
async def test_signup_is_limited(client: AsyncClient, rate_limits_on):
    statuses = []
    for _ in range(8):
        res = await client.post("/api/v1/auth/signup", json={
            "email": f"rl-{uuid.uuid4().hex[:10]}@fetchapp.dev",
            "password": "testpass123",
            "display_name": "Rate Limited",
        })
        statuses.append(res.status_code)
    assert 429 in statuses, statuses


@pytest.mark.asyncio
async def test_photo_upload_is_limited(
    client: AsyncClient, auth_headers: dict, rate_limits_on
):
    """The most expensive endpoint in the app: a 10 MB read, a CPU-bound
    Pillow pass, and a billed moderation call. It had no limit at all until
    the audit fixes; this pins that it stays."""
    import io
    from PIL import Image

    pet = await client.post(
        "/api/v1/pets", json={"name": "Limited", "species": "dog"},
        headers=auth_headers,
    )
    pet_id = pet.json()["id"]

    def _img():
        buf = io.BytesIO()
        Image.new("RGB", (16, 16), (1, 2, 3)).save(buf, format="JPEG")
        buf.seek(0)
        return buf

    statuses = []
    # The rule is 30/hour — go past it.
    for _ in range(33):
        res = await client.post(
            f"/api/v1/pets/{pet_id}/photos",
            files={"file": ("p.jpg", _img(), "image/jpeg")},
            headers=auth_headers,
        )
        statuses.append(res.status_code)
        if res.status_code == 429:
            break
    assert statuses[-1] == 429, statuses[-5:]


@pytest.mark.asyncio
async def test_tag_contact_relay_is_limited(client: AsyncClient, db_session, rate_limits_on):
    """Unauthenticated *and* it sends mail — the limit is the only thing
    between a scraped tag code and a mailbox flood."""
    from app.models.pet import Pet
    from app.models.qr_tag import QRTag
    from app.models.user import User

    owner = User(
        id=uuid.uuid4(), email=f"rl-owner-{uuid.uuid4().hex[:6]}@t.dev",
        password_hash="x", display_name="Owner", is_active=True,
    )
    pet = Pet(id=uuid.uuid4(), owner_id=owner.id, name="Rex", species="dog", is_active=True)
    tag = QRTag(code=uuid.uuid4().hex[:8].upper(), pet_id=pet.id)
    db_session.add_all([owner, pet, tag])
    await db_session.commit()

    body = {
        "finder_name": "Jane", "finder_contact": "555-0100",
        "message": "Found them.",
    }
    statuses = []
    for _ in range(8):
        res = await client.post(
            f"/api/v1/public/tags/{tag.code}/contact", json=body
        )
        statuses.append(res.status_code)
    # 5/hour, and every allowed call 503s because email is unconfigured in
    # tests — so the limiter is what turns them into 429s.
    assert 429 in statuses, statuses
    assert statuses.index(429) >= 5, f"limited too early: {statuses}"


@pytest.mark.asyncio
async def test_limits_do_not_leak_between_tests(client: AsyncClient, rate_limits_on):
    """The fixture resets counters, so a fresh test starts with a full budget.

    Without this the tests above would poison each other depending on order.
    """
    res = await client.post("/api/v1/auth/login", json={
        "email": "nobody@fetchapp.dev", "password": "wrong-password",
    })
    assert res.status_code != 429


@pytest.mark.asyncio
async def test_disabled_by_default_for_the_rest_of_the_suite(client: AsyncClient):
    """No fixture here: the limiter must be off, or every other test is flaky."""
    assert limiter.enabled is False
    for _ in range(12):
        res = await client.post("/api/v1/auth/login", json={
            "email": "nobody@fetchapp.dev", "password": "wrong-password",
        })
        assert res.status_code != 429
