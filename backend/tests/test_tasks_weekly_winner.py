"""Coverage for weekly-winner ranking logic.

We test the underlying `ranking_service` functions used by the Celery tasks
directly — the Celery wrappers are a thin `asyncio.run()` shim and the real
behavior lives in `compute_weekly_winner` / `pick_current_winner`.

Crowns are per species: one Top Dog and one Top Cat per week. The pickers
return a list of winners (one per species that had votes).
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


async def _seed_pet(client: AsyncClient, species: str = "dog") -> uuid.UUID:
    email = f"owner-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    r = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Owner",
    })
    headers = {"Authorization": f"Bearer {r.json()['tokens']['access_token']}"}
    d = await client.post(
        "/api/v1/pets",
        json={"name": f"Pet {uuid.uuid4().hex[:4]}", "species": species},
        headers=headers,
    )
    return uuid.UUID(d.json()["id"])


async def _seed_dog(client: AsyncClient) -> uuid.UUID:
    return await _seed_pet(client, "dog")


def _for(winners, species: str):
    return next((w for w in winners if w.species == species), None)


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
            Vote(voter_id=voter1, pet_id=dog_a, value=1, week_bucket=week),
            Vote(voter_id=voter2, pet_id=dog_a, value=1, week_bucket=week),
            Vote(voter_id=voter3, pet_id=dog_b, value=1, week_bucket=week),
        ])
        await db.commit()

        winner = _for(await pick_current_winner(db), "dog")
        assert winner is not None
        assert winner.pet_id == dog_a
        assert winner.score == 2

        # Re-running with no change should leave the row in place (upsert idempotent).
        winner2 = _for(await pick_current_winner(db), "dog")
        assert winner2 is not None
        assert winner2.id == winner.id

        # Adding a tiebreaker swing should update the existing row.
        db.add(Vote(voter_id=await _seed_voter(client), pet_id=dog_b, value=1, week_bucket=week))
        db.add(Vote(voter_id=await _seed_voter(client), pet_id=dog_b, value=1, week_bucket=week))
        await db.commit()
        winner3 = _for(await pick_current_winner(db), "dog")
        assert winner3 is not None
        assert winner3.pet_id == dog_b


@pytest.mark.asyncio
async def test_crowns_are_per_species(client: AsyncClient):
    """Top Dog and Top Cat are independent crowns in the same week."""
    from tests.conftest import test_session_factory

    week = current_week_bucket()
    dog = await _seed_dog(client)
    cat = await _seed_pet(client, "cat")
    v1 = await _seed_voter(client)
    v2 = await _seed_voter(client)

    async with test_session_factory() as db:
        await db.execute(delete(Vote).where(Vote.week_bucket == week))
        await db.execute(delete(WeeklyWinner).where(WeeklyWinner.week_bucket == week))
        db.add_all([
            Vote(voter_id=v1, pet_id=dog, value=1, week_bucket=week),
            Vote(voter_id=v2, pet_id=cat, value=1, week_bucket=week),
        ])
        await db.commit()

        winners = await pick_current_winner(db)
        dog_winner = _for(winners, "dog")
        cat_winner = _for(winners, "cat")
        assert dog_winner is not None and dog_winner.pet_id == dog
        assert cat_winner is not None and cat_winner.pet_id == cat
        # Two distinct crowns, same week, one per species.
        assert dog_winner.id != cat_winner.id


@pytest.mark.asyncio
async def test_compute_weekly_winner_creates_row_for_prior_week(client: AsyncClient):
    from tests.conftest import test_session_factory

    last_week = current_week_bucket() - timedelta(days=7)
    pet_id = await _seed_dog(client)
    voter = await _seed_voter(client)

    async with test_session_factory() as db:
        # Reset state for this week so leftover votes from prior test runs
        # don't out-rank our seeded vote.
        await db.execute(delete(Vote).where(Vote.week_bucket == last_week))
        await db.execute(delete(WeeklyWinner).where(WeeklyWinner.week_bucket == last_week))
        db.add(Vote(voter_id=voter, pet_id=pet_id, value=1, week_bucket=last_week))
        await db.commit()

        winner = _for(await compute_weekly_winner(db), "dog")
        assert winner is not None
        assert winner.week_bucket == last_week
        assert winner.pet_id == pet_id
        winner_row_id = winner.id

        # Re-running is an authoritative recompute: same row, no duplicate.
        again = _for(await compute_weekly_winner(db), "dog")
        assert again is not None
        assert again.id == winner_row_id

        # Votes landing after an interim compute (the final-Sunday window)
        # still count: a stronger late entrant overtakes on the next run.
        late_dog = await _seed_dog(client)
        late_voter_a = await _seed_voter(client)
        late_voter_b = await _seed_voter(client)
        db.add(Vote(voter_id=late_voter_a, pet_id=late_dog, value=1, week_bucket=last_week))
        db.add(Vote(voter_id=late_voter_b, pet_id=late_dog, value=1, week_bucket=last_week))
        await db.commit()

        final = _for(await compute_weekly_winner(db), "dog")
        assert final is not None
        assert final.id == winner_row_id  # updated in place
        assert final.pet_id == late_dog


@pytest.mark.asyncio
async def test_pick_winner_no_votes_returns_none(client: AsyncClient):
    """With no votes for a given week, the picker is a safe no-op."""
    from tests.conftest import test_session_factory
    from app.services.ranking_service import _pick_winner_for_week

    # A far-future week is guaranteed to have no votes.
    future_week = current_week_bucket() + timedelta(days=365)
    async with test_session_factory() as db:
        result = await _pick_winner_for_week(db, future_week, "dog", upsert=False)
        assert result is None
