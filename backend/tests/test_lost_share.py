"""Public share pages, sitemap and robots for lost reports (Step 0)."""
import uuid

import pytest
from httpx import AsyncClient


async def _create_report(client: AsyncClient, headers: dict, **overrides) -> dict:
    payload = {
        "kind": "missing",
        "description": "Fluffy the beagle, last seen by the river. Very friendly.",
        "last_seen_lat": 37.7749,
        "last_seen_lng": -122.4194,
    }
    payload.update(overrides)
    res = await client.post("/api/v1/lost/reports", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


async def _verify_account(client: AsyncClient, headers: dict) -> None:
    """Found reports need a verified (or week-old) account; fixtures are neither."""
    from sqlalchemy import update

    from app.models.user import User
    from tests.conftest import test_session_factory

    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200, me.text
    async with test_session_factory() as db:
        await db.execute(update(User).where(User.id == me.json()["id"]).values(is_verified=True))
        await db.commit()


@pytest.mark.asyncio
async def test_is_public_defaults_true(client: AsyncClient, auth_headers: dict):
    data = await _create_report(client, auth_headers)
    assert data["is_public"] is True


@pytest.mark.asyncio
async def test_is_public_opt_out_on_create(client: AsyncClient, auth_headers: dict):
    data = await _create_report(client, auth_headers, is_public=False)
    assert data["is_public"] is False


@pytest.mark.asyncio
async def test_public_share_page_renders_og_and_share_targets(
    client: AsyncClient, auth_headers: dict
):
    data = await _create_report(client, auth_headers)
    res = await client.get(f"/lost/{data['id']}")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/html")
    body = res.text
    # Open Graph + Twitter tags a social scraper reads without running JS
    assert 'property="og:title"' in body
    assert 'property="og:image"' in body
    assert 'name="twitter:card" content="summary_large_image"' in body
    assert f"/lost/{data['id']}" in body  # canonical / og:url
    assert 'name="robots" content="index,follow"' in body
    # One-tap share targets, incl. the Nextdoor ShareKit link
    assert "nextdoor.com/sharekit/" in body
    assert "facebook.com/sharer" in body
    assert "twitter.com/intent/tweet" in body
    # Report content is rendered
    assert "Fluffy the beagle" in body
    # Location is surfaced only as a fuzzed map link, never raw coordinates
    assert "openstreetmap.org" in body


@pytest.mark.asyncio
async def test_share_page_without_a_pet_photo_draws_no_photo(
    client: AsyncClient, auth_headers: dict
):
    """The brand card is the link preview's fallback, never the pet's picture.

    A found report has no pet attached, so there is no photo of the animal. The
    page used to draw the og-image — a cartoon dog under a "#1 this week"
    rosette — in the card as "Photo of A found pet".
    """
    await _verify_account(client, auth_headers)
    data = await _create_report(client, auth_headers, kind="found")
    body = (await client.get(f"/lost/{data['id']}")).text
    # Scrapers still get an image…
    assert 'property="og:image" content=' in body
    assert "og-image.png" in body
    # …but the page body shows none, and nothing calls the brand card a photo.
    assert "<img class=\"photo\"" not in body
    assert "Photo of" not in body


@pytest.mark.asyncio
async def test_found_share_page_asks_for_the_owner_not_a_sighting(
    client: AsyncClient, auth_headers: dict
):
    """A found report has a finder to reach, not a pet to spot."""
    await _verify_account(client, auth_headers)
    found = await _create_report(client, auth_headers, kind="found")
    body = (await client.get(f"/lost/{found['id']}")).text
    assert "Is this your pet?" in body
    assert "Report a sighting" not in body
    assert "Seen A found pet" not in body
    assert "<title>Found pet · Fetchpawz</title>" in body

    missing = await _create_report(client, auth_headers)
    body = (await client.get(f"/lost/{missing['id']}")).text
    assert "Seen this pet? Report a sighting" in body
    assert "<title>Missing pet · Fetchpawz</title>" in body


@pytest.mark.asyncio
async def test_private_report_share_page_404(client: AsyncClient, auth_headers: dict):
    data = await _create_report(client, auth_headers, is_public=False)
    res = await client.get(f"/lost/{data['id']}")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_unknown_report_share_page_404(client: AsyncClient):
    res = await client.get(f"/lost/{uuid.uuid4()}")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_share_page_does_not_leak_contact_value(
    client: AsyncClient, auth_headers: dict
):
    data = await _create_report(
        client, auth_headers, contact_method="phone", contact_value="555-000-9999"
    )
    res = await client.get(f"/lost/{data['id']}")
    assert res.status_code == 200
    assert "555-000-9999" not in res.text


@pytest.mark.asyncio
async def test_patch_toggles_public_page(client: AsyncClient, auth_headers: dict):
    data = await _create_report(client, auth_headers)
    rid = data["id"]

    res = await client.patch(
        f"/api/v1/lost/reports/{rid}", json={"is_public": False}, headers=auth_headers
    )
    assert res.status_code == 200
    assert res.json()["is_public"] is False
    assert (await client.get(f"/lost/{rid}")).status_code == 404

    res = await client.patch(
        f"/api/v1/lost/reports/{rid}", json={"is_public": True}, headers=auth_headers
    )
    assert res.json()["is_public"] is True
    assert (await client.get(f"/lost/{rid}")).status_code == 200


@pytest.mark.asyncio
async def test_resolved_public_report_is_noindex(client: AsyncClient, auth_headers: dict):
    data = await _create_report(client, auth_headers)
    rid = data["id"]
    await client.post(f"/api/v1/lost/reports/{rid}/resolve", headers=auth_headers)
    res = await client.get(f"/lost/{rid}")
    assert res.status_code == 200
    assert 'content="noindex"' in res.text


@pytest.mark.asyncio
async def test_sitemap_lists_public_open_only(client: AsyncClient, auth_headers: dict):
    public = await _create_report(client, auth_headers)
    private = await _create_report(client, auth_headers, is_public=False)
    res = await client.get("/sitemap.xml")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/xml")
    assert f"/lost/{public['id']}" in res.text
    assert f"/lost/{private['id']}" not in res.text


@pytest.mark.asyncio
async def test_robots_txt_disallows_app_and_points_at_sitemap(client: AsyncClient):
    res = await client.get("/robots.txt")
    assert res.status_code == 200
    body = res.text
    assert "Disallow: /app/" in body
    assert "Disallow: /admin/" in body
    assert "Sitemap:" in body
    assert "/sitemap.xml" in body
