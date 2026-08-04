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
