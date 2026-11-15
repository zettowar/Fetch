import pytest
from httpx import AsyncClient

from app.services.feed_service import current_week_bucket


@pytest.mark.asyncio
async def test_rankings_requires_auth(client: AsyncClient):
    res = await client.get("/api/v1/rankings/current")
    assert res.status_code in (401, 403)


@pytest.mark.asyncio
async def test_rankings_returns_list(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/rankings/current", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_winner_returns_null_when_none(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/rankings/winner/current", headers=auth_headers)
    assert res.status_code == 200


def test_week_bucket_returns_monday():
    from datetime import datetime, timezone
    # Wednesday 2026-01-07
    dt = datetime(2026, 1, 7, 12, 0, 0, tzinfo=timezone.utc)
    bucket = current_week_bucket(dt)
    assert bucket.weekday() == 0  # Monday
    assert bucket.isoformat() == "2026-01-05"


@pytest.mark.asyncio
async def test_leaderboard_carries_each_pets_approved_photo(client: AsyncClient):
    """The podium shows the face a pet wears everywhere else, never a held one."""
    import uuid

    from app.models.pet import Pet
    from app.models.photo import Photo
    from app.models.vote import Vote
    from tests.conftest import test_session_factory

    async def signup() -> tuple[uuid.UUID, dict]:
        r = await client.post("/api/v1/auth/signup", json={
            "email": f"rank-{uuid.uuid4().hex[:8]}@fetchapp.dev",
            "password": "password123", "display_name": "Rank",
        })
        body = r.json()
        return uuid.UUID(body["user"]["id"]), {
            "Authorization": f"Bearer {body['tokens']['access_token']}"
        }

    voter_id, _ = await signup()
    _, owner_headers = await signup()

    async def pet(name: str, photo_status: str | None) -> uuid.UUID:
        res = await client.post("/api/v1/pets", json={"name": name}, headers=owner_headers)
        pet_id = uuid.UUID(res.json()["id"])
        async with test_session_factory() as db:
            if photo_status:
                photo = Photo(
                    pet_id=pet_id, storage_key=f"ranktest/{pet_id}.jpg",
                    width=100, height=100, content_type="image/jpeg",
                    moderation_status=photo_status,
                )
                db.add(photo)
                await db.flush()
                # Forced straight in: the API would refuse a withheld primary,
                # which is exactly the invariant this guards against slipping.
                (await db.get(Pet, pet_id)).primary_photo_id = photo.id
            db.add(Vote(voter_id=voter_id, pet_id=pet_id, value=1, week_bucket=current_week_bucket()))
            await db.commit()
        return pet_id

    shown = await pet("Shown", "approved")
    held = await pet("Held", "flagged")
    bare = await pet("Bare", None)

    # Straight to the service with a wide limit: the endpoint's top 20 would
    # let other tests' earlier votes win the ties and push these three out.
    from app.services.ranking_service import get_current_leaderboard

    async with test_session_factory() as db:
        board = await get_current_leaderboard(db, limit=10_000)
    by_id = {e["pet_id"]: e for e in board}
    assert f"ranktest/{shown}.jpg" in by_id[str(shown)]["primary_photo_url"]
    assert by_id[str(held)]["primary_photo_url"] is None
    assert by_id[str(bare)]["primary_photo_url"] is None
