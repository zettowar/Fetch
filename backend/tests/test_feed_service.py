"""Direct coverage for `feed_service.get_feed` ranking + filtering rules."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select

from app.models.dog import Dog
from app.models.photo import Photo
from app.models.user import User
from app.models.vote import Vote
from app.services.feed_service import current_week_bucket, get_feed


def test_current_week_bucket_returns_iso_monday():
    # Sunday 2026-03-01 → ISO week starts Mon 2026-02-23
    sunday = datetime(2026, 3, 1, 23, 59, tzinfo=timezone.utc)
    bucket = current_week_bucket(sunday)
    assert bucket.weekday() == 0
    assert bucket.isoformat() == "2026-02-23"

    # Monday 2026-03-02 → that same Monday
    monday = datetime(2026, 3, 2, 0, 0, tzinfo=timezone.utc)
    assert current_week_bucket(monday).isoformat() == "2026-03-02"


async def _signup(client: AsyncClient) -> tuple[uuid.UUID, dict]:
    email = f"feed-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    r = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Feed",
    })
    return uuid.UUID(r.json()["user"]["id"]), {
        "Authorization": f"Bearer {r.json()['tokens']['access_token']}"
    }


async def _create_dog_with_photo(
    client: AsyncClient, headers: dict, name: str, *, db_session_factory
) -> uuid.UUID:
    res = await client.post("/api/v1/dogs", json={"name": name}, headers=headers)
    dog_id = uuid.UUID(res.json()["id"])
    # Attach an approved photo so the dog passes the has_photo filter.
    async with db_session_factory() as db:
        db.add(Photo(
            dog_id=dog_id,
            storage_key=f"feedtest/{dog_id}.jpg",
            width=100, height=100, content_type="image/jpeg",
            moderation_status="approved",
        ))
        await db.commit()
    return dog_id


@pytest.mark.asyncio
async def test_get_feed_excludes_own_inactive_adopted_and_voted(client: AsyncClient):
    from tests.conftest import test_session_factory

    viewer_id, viewer_headers = await _signup(client)
    other_id, other_headers = await _signup(client)

    own_dog = await _create_dog_with_photo(
        client, viewer_headers, "MyOwn", db_session_factory=test_session_factory,
    )
    inactive_dog = await _create_dog_with_photo(
        client, other_headers, "Inactive", db_session_factory=test_session_factory,
    )
    adopted_dog = await _create_dog_with_photo(
        client, other_headers, "Adopted", db_session_factory=test_session_factory,
    )
    voted_dog = await _create_dog_with_photo(
        client, other_headers, "Voted", db_session_factory=test_session_factory,
    )
    eligible_dog = await _create_dog_with_photo(
        client, other_headers, "Eligible", db_session_factory=test_session_factory,
    )

    week = current_week_bucket()
    async with test_session_factory() as db:
        # Mark inactive + adopted directly.
        d1 = await db.get(Dog, inactive_dog)
        d1.is_active = False
        d2 = await db.get(Dog, adopted_dog)
        d2.adopted_at = datetime.now(timezone.utc)
        # Record a vote so `voted_dog` is excluded for this viewer this week.
        db.add(Vote(voter_id=viewer_id, dog_id=voted_dog, value=1, week_bucket=week))
        await db.commit()

        # Query a generous limit since the DB carries dogs from earlier tests.
        feed = await get_feed(viewer_id, db, limit=10_000)

    feed_ids = {d.id for d in feed}
    # Exclusion contract — these must never appear in the viewer's feed.
    assert own_dog not in feed_ids
    assert inactive_dog not in feed_ids
    assert adopted_dog not in feed_ids
    assert voted_dog not in feed_ids
    # `eligible_dog` should be eligible (no exclusion reason).
    assert eligible_dog in feed_ids


@pytest.mark.asyncio
async def test_get_feed_respects_limit(client: AsyncClient):
    from tests.conftest import test_session_factory

    viewer_id, _ = await _signup(client)
    _, owner_headers = await _signup(client)

    for i in range(3):
        await _create_dog_with_photo(
            client, owner_headers, f"L{i}", db_session_factory=test_session_factory,
        )

    async with test_session_factory() as db:
        feed = await get_feed(viewer_id, db, limit=2)
    assert len(feed) <= 2
