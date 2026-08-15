"""Community posts: the router shipped with a GIN index and zero tests."""
import uuid

import pytest
from httpx import AsyncClient

from app.models.social import Block
from app.models.user import User


async def _create(client: AsyncClient, headers: dict, **over):
    payload = {"title": "Crate training help", "body": "Any tips for night one?"}
    payload.update(over)
    return await client.post("/api/v1/posts", json=payload, headers=headers)


@pytest.mark.asyncio
async def test_create_and_read_back(client: AsyncClient, auth_headers: dict):
    res = await _create(client, auth_headers)
    assert res.status_code == 201
    body = res.json()
    assert body["kind"] == "community"
    assert body["pinned"] is False
    assert body["author_name"]

    got = await client.get(f"/api/v1/posts/{body['id']}", headers=auth_headers)
    assert got.status_code == 200
    assert got.json()["title"] == "Crate training help"


@pytest.mark.asyncio
async def test_requires_auth(client: AsyncClient):
    assert (await client.get("/api/v1/posts")).status_code in (401, 403)
    assert (await _create(client, {})).status_code in (401, 403)


@pytest.mark.asyncio
async def test_ordinary_users_cannot_create_editorial_kinds(
    client: AsyncClient, auth_headers: dict
):
    """`sponsor` and `rescue_spotlight` render differently — staff only."""
    for kind in ("sponsor", "rescue_spotlight"):
        res = await _create(client, auth_headers, kind=kind)
        assert res.status_code == 403, kind


@pytest.mark.asyncio
async def test_staff_can_create_editorial_kinds(
    client: AsyncClient, admin_headers: dict
):
    res = await _create(client, admin_headers, kind="rescue_spotlight")
    assert res.status_code == 201
    assert res.json()["kind"] == "rescue_spotlight"


@pytest.mark.asyncio
async def test_unknown_kind_is_rejected(client: AsyncClient, auth_headers: dict):
    assert (await _create(client, auth_headers, kind="nonsense")).status_code == 422


@pytest.mark.asyncio
async def test_tags_are_normalised_and_capped(
    client: AsyncClient, auth_headers: dict
):
    res = await _create(
        client, auth_headers,
        tags=["  Puppies ", "puppies", "PUPPIES", "a", "b", "c", "d", "e"],
    )
    assert res.status_code == 201
    tags = res.json()["tags"]
    assert tags[0] == "puppies"
    assert len(tags) == len(set(tags)), "casing variants must collapse"
    assert len(tags) <= 5


@pytest.mark.asyncio
async def test_full_text_search_matches_title_and_body(
    client: AsyncClient, auth_headers: dict
):
    marker = uuid.uuid4().hex[:10]
    await _create(client, auth_headers, title=f"About {marker}", body="unrelated")
    await _create(client, auth_headers, title="Other", body=f"mentions {marker} here")
    await _create(client, auth_headers, title="Nothing", body="to do with it")

    res = await client.get(
        "/api/v1/posts", params={"search": marker}, headers=auth_headers
    )
    assert res.status_code == 200
    assert len(res.json()) == 2


@pytest.mark.asyncio
async def test_filter_by_kind_and_tag(client: AsyncClient, auth_headers: dict):
    tag = uuid.uuid4().hex[:8]
    await _create(client, auth_headers, tags=[tag])
    await _create(client, auth_headers, tags=["something-else"])

    res = await client.get(
        "/api/v1/posts", params={"tag": tag}, headers=auth_headers
    )
    assert [p["tags"] for p in res.json()] == [[tag]]

    res = await client.get(
        "/api/v1/posts", params={"kind": "community"}, headers=auth_headers
    )
    assert all(p["kind"] == "community" for p in res.json())


@pytest.mark.asyncio
async def test_blocked_authors_posts_are_hidden_both_ways(
    client: AsyncClient, auth_headers: dict, db_session
):
    """A blocked author's posts must not reach the blocker, in list or detail."""
    me = (await client.get("/api/v1/users/me", headers=auth_headers)).json()

    other = User(
        id=uuid.uuid4(), email=f"blocked-{uuid.uuid4()}@t.dev",
        password_hash="x", display_name="Blocked Author", is_active=True,
    )
    db_session.add(other)
    await db_session.flush()

    from app.models.post import Post

    post = Post(
        id=uuid.uuid4(), author_id=other.id, kind="community",
        title="Hidden post", body="should not be visible",
    )
    db_session.add_all([post, Block(blocker_id=uuid.UUID(me["id"]), blocked_id=other.id)])
    await db_session.commit()

    listed = await client.get("/api/v1/posts", headers=auth_headers)
    assert all(p["id"] != str(post.id) for p in listed.json())

    detail = await client.get(f"/api/v1/posts/{post.id}", headers=auth_headers)
    assert detail.status_code == 404


@pytest.mark.asyncio
async def test_only_author_or_admin_can_delete(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    mine = (await _create(client, auth_headers)).json()

    # Someone else's account cannot delete it...
    theirs = (await _create(client, admin_headers)).json()
    assert (await client.delete(
        f"/api/v1/posts/{theirs['id']}", headers=auth_headers
    )).status_code == 403

    # ...the author can...
    assert (await client.delete(
        f"/api/v1/posts/{mine['id']}", headers=auth_headers
    )).status_code == 200
    assert (await client.get(
        f"/api/v1/posts/{mine['id']}", headers=auth_headers
    )).status_code == 404

    # ...and an admin can delete anyone's.
    assert (await client.delete(
        f"/api/v1/posts/{theirs['id']}", headers=admin_headers
    )).status_code == 200


@pytest.mark.asyncio
async def test_posts_are_reportable(client: AsyncClient, auth_headers: dict, admin_headers: dict):
    """Posts are user-generated text, so they must reach the moderation queue."""
    post = (await _create(client, admin_headers)).json()
    res = await client.post(
        "/api/v1/reports",
        json={"target_type": "post", "target_id": post["id"], "reason": "spam"},
        headers=auth_headers,
    )
    assert res.status_code == 201
    assert res.json()["target_type"] == "post"
