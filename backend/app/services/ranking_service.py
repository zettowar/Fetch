import logging
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.models.pet import Pet, SPECIES
from app.models.vote import Vote
from app.models.weekly_winner import WeeklyWinner
from app.services.breed_display import breed_display
from app.services.feed_service import current_week_bucket

logger = logging.getLogger(__name__)


async def get_current_leaderboard(
    db: AsyncSession, species: str | None = None, limit: int = 20
) -> list[dict]:
    week = current_week_bucket()
    query = (
        select(
            Vote.pet_id,
            func.sum(Vote.value).label("score"),
            func.count().label("total_votes"),
        )
        .join(Pet, Pet.id == Vote.pet_id)
        .where(Vote.week_bucket == week)
    )
    if species:
        query = query.where(Pet.species == species)
    query = (
        query.group_by(Vote.pet_id)
        .order_by(func.sum(Vote.value).desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    pet_ids = [row.pet_id for row in rows]
    pets_by_id: dict = {}
    if pet_ids:
        pet_result = await db.execute(
            select(Pet).options(selectinload(Pet.breeds)).where(Pet.id.in_(pet_ids))
        )
        pets_by_id = {d.id: d for d in pet_result.scalars().all()}

    leaderboard = []
    for rank, row in enumerate(rows, 1):
        pet = pets_by_id.get(row.pet_id)
        if pet:
            leaderboard.append({
                "rank": rank,
                "pet_id": str(pet.id),
                "pet_name": pet.name,
                "species": pet.species,
                "breed": breed_display(pet.mix_type, pet.breeds, pet.species),
                "score": row.score,
                "total_votes": row.total_votes,
            })

    return leaderboard


async def get_pet_stats(pet_id: UUID, db: AsyncSession) -> dict:
    likes = await db.execute(
        select(func.count()).where(Vote.pet_id == pet_id, Vote.value == 1)
    )
    passes = await db.execute(
        select(func.count()).where(Vote.pet_id == pet_id, Vote.value == -1)
    )

    # This week's standing is scoped to the pet's own species — a cat ranks
    # among cats, a dog among dogs.
    species = (
        await db.execute(select(Pet.species).where(Pet.id == pet_id))
    ).scalar_one_or_none()
    week = current_week_bucket()
    scores_sq = (
        select(Vote.pet_id, func.sum(Vote.value).label("score"))
        .join(Pet, Pet.id == Vote.pet_id)
        .where(Vote.week_bucket == week, Pet.species == species)
        .group_by(Vote.pet_id)
        .subquery()
    )
    week_total = (
        await db.execute(select(func.count()).select_from(scores_sq))
    ).scalar() or 0
    week_score = (
        await db.execute(select(scores_sq.c.score).where(scores_sq.c.pet_id == pet_id))
    ).scalar_one_or_none()
    week_rank = None
    if week_score is not None:
        higher = (
            await db.execute(
                select(func.count()).select_from(scores_sq).where(scores_sq.c.score > week_score)
            )
        ).scalar() or 0
        week_rank = higher + 1

    crowns = await db.execute(
        select(WeeklyWinner.week_bucket)
        .where(WeeklyWinner.pet_id == pet_id)
        .order_by(WeeklyWinner.week_bucket.desc())
    )

    return {
        "likes": likes.scalar() or 0,
        "passes": passes.scalar() or 0,
        "week_score": week_score,
        "week_rank": week_rank,
        "week_total": week_total,
        "crown_weeks": list(crowns.scalars().all()),
    }


async def compute_weekly_winner(db: AsyncSession) -> list[WeeklyWinner]:
    """Compute the prior week's winner *per species* (production weekly job).

    One crown per species — Top Dog and Top Cat. Upserts rather than skips: the
    10-minute pick_current_winner job usually creates the row during the week,
    but votes cast in its final window would otherwise never be counted —
    Monday's run is the authoritative tally.
    """
    last_week = current_week_bucket() - timedelta(days=7)
    winners = []
    for species in SPECIES:
        w = await _pick_winner_for_week(db, last_week, species, upsert=True, notify_win=True)
        if w:
            winners.append(w)
    return winners


async def pick_current_winner(db: AsyncSession) -> list[WeeklyWinner]:
    """Compute (or update) the *current* week's winner per species.

    Used by the troubleshooting 10-minute beat job so a winner appears as
    soon as anyone votes, and updates as the leaderboard shifts.
    """
    week = current_week_bucket()
    winners = []
    for species in SPECIES:
        w = await _pick_winner_for_week(db, week, species, upsert=True)
        if w:
            winners.append(w)
    return winners


async def _pick_winner_for_week(
    db: AsyncSession, week: date, species: str, *, upsert: bool, notify_win: bool = False
) -> WeeklyWinner | None:
    # Ties break deterministically: first pet to enter the race wins, with
    # pet_id as a final absolute tiebreaker. Scoped to one species.
    query = (
        select(Vote.pet_id, func.sum(Vote.value).label("score"))
        .join(Pet, Pet.id == Vote.pet_id)
        .where(Vote.week_bucket == week, Pet.species == species)
        .group_by(Vote.pet_id)
        .order_by(
            func.sum(Vote.value).desc(),
            func.min(Vote.created_at).asc(),
            Vote.pet_id.asc(),
        )
        .limit(1)
    )
    result = await db.execute(query)
    row = result.first()

    if not row:
        logger.info("No %s votes found for week %s", species, week)
        return None

    if upsert:
        existing_q = await db.execute(
            select(WeeklyWinner).where(
                WeeklyWinner.week_bucket == week, WeeklyWinner.species == species
            )
        )
        existing = existing_q.scalar_one_or_none()
        if existing:
            if existing.pet_id != row.pet_id or existing.score != row.score:
                existing.pet_id = row.pet_id
                existing.score = row.score
                await db.commit()
                logger.info(
                    "Updated %s winner for week %s: pet %s with score %s",
                    species, week, row.pet_id, row.score,
                )
            else:
                logger.info("%s winner for week %s unchanged", species, week)
            if notify_win:
                await _notify_winner(db, week, species, row.pet_id, row.score)
            return existing

    winner = WeeklyWinner(
        week_bucket=week,
        species=species,
        pet_id=row.pet_id,
        score=row.score,
    )
    db.add(winner)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        logger.info("%s winner for week %s already exists (race handled)", species, week)
        return None
    logger.info("%s winner for week %s: pet %s with score %s", species, week, row.pet_id, row.score)
    if notify_win:
        await _notify_winner(db, week, species, row.pet_id, row.score)
    return winner


async def _notify_winner(
    db: AsyncSession, week: date, species: str, pet_id, score: int
) -> None:
    """Tell the owner their pet took the crown — once per week, however many
    times the final tally re-runs (the title embeds the week, so a duplicate
    is detectable)."""
    from app.models.notification import Notification
    from app.services.notify import notify

    pet = (await db.execute(select(Pet).where(Pet.id == pet_id))).scalar_one_or_none()
    if not pet:
        return
    crown = "Top Cat" if species == "cat" else "Top Dog"
    title = f"{pet.name} is {crown} for the week of {week.isoformat()}! 🏆"
    already = (
        await db.execute(
            select(Notification.id).where(
                Notification.user_id == pet.owner_id,
                Notification.type == "weekly_winner",
                Notification.title == title,
            )
        )
    ).scalar_one_or_none()
    if already:
        return
    if await notify(
        db, pet.owner_id,
        type="weekly_winner",
        title=title,
        body=f"Final score: {score} ❤️",
        link=f"/app/pets/{pet.id}",
    ):
        await db.commit()
