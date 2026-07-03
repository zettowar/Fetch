"""Coverage for weekly-winner ranking logic.

We test the underlying `ranking_service` functions used by the Celery tasks
directly — the Celery wrappers are a thin `asyncio.run()` shim and the real
behavior lives in `compute_weekly_winner` / `pick_current_winner`.
"""
import uuid
from datetime import timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import delete

from app.models.vote import Vote
from app.models.weekly_winner import WeeklyWinner
from app.services.feed_service import current_week_bucket
from app.services.ranking_service import compute_weekly_winner, pick_current_winner


async def _seed_voter(client: AsyncClient) -> uuid.UUID:
    email = f"voter-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    r = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Voter",
    })
    return uuid.UUID(r.json()["user"]["id"])


async def _seed_dog(client: AsyncClient) -> uuid.UUID:
    email = f"owner-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    r = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Owner",
    })
    headers = {"Authorization": f"Bearer {r.json()['tokens']['access_token']}"}
    d = await client.post("/api/v1/dogs", json={"name": f"Pup {uuid.uuid4().hex[:4]}"}, headers=headers)
    return uuid.UUID(d.json()["id"])


@pytest.mark.asyncio
async def test_pick_current_winner_picks_top_score(client: AsyncClient):
    from tests.conftest import test_session_factory

    week = current_week_bucket()
    dog_a = await _seed_dog(client)
    dog_b = await _seed_dog(client)
    voter1 = await _seed_voter(client)
    voter2 = await _seed_voter(client)
    voter3 = await _seed_voter(client)

    async with test_session_factory() as db:
        # Reset state for this week so other tests' votes don't perturb the ranking.
        await db.execute(delete(Vote).where(Vote.week_bucket == week))
        await db.execute(delete(WeeklyWinner).where(WeeklyWinner.week_bucket == week))
        # dog_a: +2, dog_b: +1
        db.add_all([
            Vote(voter_id=voter1, dog_id=dog_a, value=1, week_bucket=week),
            Vote(voter_id=voter2, dog_id=dog_a, value=1, week_bucket=week),
            Vote(voter_id=voter3, dog_id=dog_b, value=1, week_bucket=week),
        ])
        await db.commit()

        winner = await pick_current_winner(db)
        assert winner is not None
        assert winner.dog_id == dog_a
        assert winner.score == 2

        # Re-running with no change should leave the row in place (upsert idempotent).
        winner2 = await pick_current_winner(db)
        assert winner2 is not None
        assert winner2.id == winner.id

        # Adding a tiebreaker swing should update the existing row.
        db.add(Vote(voter_id=await _seed_voter(client), dog_id=dog_b, value=1, week_bucket=week))
        db.add(Vote(voter_id=await _seed_voter(client), dog_id=dog_b, value=1, week_bucket=week))
        await db.commit()
        winner3 = await pick_current_winner(db)
        assert winner3 is not None
        assert winner3.dog_id == dog_b


@pytest.mark.asyncio
async def test_compute_weekly_winner_creates_row_for_prior_week(client: AsyncClient):
    from tests.conftest import test_session_factory

    last_week = current_week_bucket() - timedelta(days=7)
    dog_id = await _seed_dog(client)
    voter = await _seed_voter(client)

    async with test_session_factory() as db:
        # Reset state for this week so leftover votes from prior test runs
        # don't out-rank our seeded vote.
        await db.execute(delete(Vote).where(Vote.week_bucket == last_week))
        await db.execute(delete(WeeklyWinner).where(WeeklyWinner.week_bucket == last_week))
        db.add(Vote(voter_id=voter, dog_id=dog_id, value=1, week_bucket=last_week))
        await db.commit()

        winner = await compute_weekly_winner(db)
        assert winner is not None
        assert winner.week_bucket == last_week
        assert winner.dog_id == dog_id

        # Idempotent: second invocation finds the existing row and returns None.
        again = await compute_weekly_winner(db)
        assert again is None


@pytest.mark.asyncio
async def test_pick_winner_no_votes_returns_none(client: AsyncClient):
    """With no votes for a given week, the picker is a safe no-op."""
    from tests.conftest import test_session_factory
    from app.services.ranking_service import _pick_winner_for_week

    # A far-future week is guaranteed to have no votes.
    future_week = current_week_bucket() + timedelta(days=365)
    async with test_session_factory() as db:
        result = await _pick_winner_for_week(db, future_week, upsert=False)
        assert result is None
