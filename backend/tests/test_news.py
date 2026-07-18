import pytest
from httpx import AsyncClient


def _post_payload(**overrides) -> dict:
    payload = {
        "title": "Test article",
        "body": "Something happened at Fetchpawz.",
        "tag": "Product",
        "is_published": True,
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_create_and_public_list(client: AsyncClient, admin_headers: dict):
    res = await client.post("/api/v1/admin/news", json=_post_payload(), headers=admin_headers)
    assert res.status_code == 201
    created = res.json()
    assert created["is_published"] is True
    assert created["published_at"] is not None

    public = await client.get("/api/v1/public/news")
    assert public.status_code == 200
    assert created["id"] in [p["id"] for p in public.json()]


@pytest.mark.asyncio
async def test_draft_hidden_publicly_until_published(client: AsyncClient, admin_headers: dict):
    res = await client.post(
        "/api/v1/admin/news",
        json=_post_payload(title="Draft article", is_published=False),
        headers=admin_headers,
    )
    assert res.status_code == 201
    draft = res.json()
    assert draft["published_at"] is None

    public_ids = [p["id"] for p in (await client.get("/api/v1/public/news")).json()]
    assert draft["id"] not in public_ids

    # Admin still sees it.
    admin_ids = [p["id"] for p in (await client.get("/api/v1/admin/news", headers=admin_headers)).json()]
    assert draft["id"] in admin_ids

    # Publishing stamps published_at and makes it public.
    upd = await client.patch(
        f"/api/v1/admin/news/{draft['id']}",
        json={"is_published": True},
        headers=admin_headers,
    )
    assert upd.status_code == 200
    assert upd.json()["published_at"] is not None
    public_ids = [p["id"] for p in (await client.get("/api/v1/public/news")).json()]
    assert draft["id"] in public_ids


@pytest.mark.asyncio
async def test_public_list_ordering(client: AsyncClient, admin_headers: dict):
    older = (await client.post(
        "/api/v1/admin/news", json=_post_payload(title="Older post"), headers=admin_headers,
    )).json()
    await client.patch(
        f"/api/v1/admin/news/{older['id']}",
        json={"published_at": "2026-01-01T00:00:00Z"},
        headers=admin_headers,
    )
    newer = (await client.post(
        "/api/v1/admin/news", json=_post_payload(title="Newer post"), headers=admin_headers,
    )).json()

    posts = (await client.get("/api/v1/public/news")).json()
    ids = [p["id"] for p in posts]
    assert ids.index(newer["id"]) < ids.index(older["id"])


@pytest.mark.asyncio
async def test_update_and_delete(client: AsyncClient, admin_headers: dict):
    post = (await client.post(
        "/api/v1/admin/news", json=_post_payload(), headers=admin_headers,
    )).json()

    upd = await client.patch(
        f"/api/v1/admin/news/{post['id']}",
        json={"title": "Retitled", "link_url": "/", "link_label": "Join the waitlist"},
        headers=admin_headers,
    )
    assert upd.status_code == 200
    assert upd.json()["title"] == "Retitled"
    assert upd.json()["link_label"] == "Join the waitlist"

    deleted = await client.delete(f"/api/v1/admin/news/{post['id']}", headers=admin_headers)
    assert deleted.status_code == 200
    public_ids = [p["id"] for p in (await client.get("/api/v1/public/news")).json()]
    assert post["id"] not in public_ids


@pytest.mark.asyncio
async def test_admin_endpoints_require_admin(client: AsyncClient, auth_headers: dict):
    assert (await client.get("/api/v1/admin/news", headers=auth_headers)).status_code == 403
    assert (
        await client.post("/api/v1/admin/news", json=_post_payload(), headers=auth_headers)
    ).status_code == 403


@pytest.mark.asyncio
async def test_create_rejects_empty_title(client: AsyncClient, admin_headers: dict):
    res = await client.post(
        "/api/v1/admin/news", json=_post_payload(title="   "), headers=admin_headers,
    )
    assert res.status_code == 422
