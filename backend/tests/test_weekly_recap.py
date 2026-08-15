"""The Monday recap — the retention half of the rate → crown loop.

Gated by the `weekly_recap_enabled` admin setting, default OFF, because turning
it on mails every active pet owner.
"""
import uuid
from datetime import timedelta

import pytest
from sqlalchemy import delete, select

import app.tasks.weekly_recap as recap_task
# Aliased: pytest would try to collect a module-level name starting with
# `test_` as a test function.
from tests.conftest import test_session_factory as session_factory
from app.models.app_setting import AppSetting
from app.models.notification import Notification, NotificationPreference
from app.models.pet import Pet
from app.models.user import User
from app.models.vote import Vote
from app.services.feed_service import current_week_bucket
from app.services.ranking_service import get_week_standings


async def _set_flag(db, value: bool):
    from app.services import settings_service

    await db.execute(delete(AppSetting).where(AppSetting.key == "weekly_recap_enabled"))
    db.add(AppSetting(key="weekly_recap_enabled", value=value))
    await db.commit()
    settings_service._cache.clear()  # the service memoises for 30s


async def _owner_with_voted_pet(db, *, likes: int = 3, name: str | None = None):
    """An owner whose pet received `likes` up-votes last week."""
    owner = User(
        id=uuid.uuid4(), email=f"recap-{uuid.uuid4().hex[:8]}@t.dev",
        password_hash="x", display_name="Recap Owner", is_active=True,
    )
    pet = Pet(
        id=uuid.uuid4(), owner_id=owner.id, name=name or f"Pet{uuid.uuid4().hex[:4]}",
        species="dog", is_active=True,
    )
    db.add_all([owner, pet])
    await db.flush()

    last_week = current_week_bucket() - timedelta(days=7)
    for _ in range(likes):
        voter = User(
            id=uuid.uuid4(), email=f"voter-{uuid.uuid4().hex[:8]}@t.dev",
            password_hash="x", display_name="Voter", is_active=True,
        )
        db.add(voter)
        await db.flush()
        db.add(Vote(voter_id=voter.id, pet_id=pet.id, value=1, week_bucket=last_week))
    await db.commit()
    return owner, pet


@pytest.fixture
def captured_mail(monkeypatch):
    sent: list[dict] = []

    async def fake_send(to, **kwargs):
        sent.append({"to": to, **kwargs})
        return True

    from app.config import settings

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(
        "app.services.email.send_weekly_recap_email", fake_send, raising=True
    )
    return sent


@pytest.fixture(autouse=True)
async def _clean(db_session):
    """Isolate the recap window.

    These tests insert votes into last-week / week-before buckets, and the
    ranking they assert on is RELATIVE — a pet left behind by an earlier test
    with a higher score silently changes another test's rank. Clearing both
    buckets before and after keeps each test independent, and stops the rows
    leaking into test_rankings / test_votes / the weekly-winner tests.
    """
    weeks = [
        current_week_bucket() - timedelta(days=7),
        current_week_bucket() - timedelta(days=14),
    ]

    async def _wipe():
        await db_session.execute(delete(Vote).where(Vote.week_bucket.in_(weeks)))
        await db_session.execute(
            delete(Notification).where(Notification.type == "weekly_recap")
        )
        await db_session.commit()

    await _wipe()
    yield
    await _wipe()


# --- the gate ---


@pytest.mark.asyncio
async def test_disabled_by_default(db_session):
    """The flag ships off, so shipping the code cannot start sending."""
    from app.services import settings_service

    settings_service._cache.clear()
    await db_session.execute(
        delete(AppSetting).where(AppSetting.key == "weekly_recap_enabled")
    )
    await db_session.commit()
    assert await settings_service.get_setting(db_session, "weekly_recap_enabled") is False


@pytest.mark.asyncio
async def test_no_ops_while_the_flag_is_off(db_session, captured_mail):
    await _owner_with_voted_pet(db_session)
    await _set_flag(db_session, False)

    assert await recap_task._run(session_factory) == 0
    assert captured_mail == []

    inbox = (await db_session.execute(
        select(Notification).where(Notification.type == "weekly_recap")
    )).scalars().all()
    assert inbox == []


# --- the happy path ---


@pytest.mark.asyncio
async def test_emails_and_notifies_when_enabled(db_session, captured_mail):
    owner, pet = await _owner_with_voted_pet(db_session, likes=3, name="Champ")
    await _set_flag(db_session, True)

    sent = await recap_task._run(session_factory)
    assert sent >= 1

    mine = [m for m in captured_mail if m["to"] == owner.email]
    assert len(mine) == 1, "one email per owner, not one per pet"
    row = next(p for p in mine[0]["pets"] if p["name"] == "Champ")
    assert row["likes"] == 3
    # rank >= 1 is vacuously true; assert the shape the email actually renders.
    assert row["rank"] == 1
    assert row["tied_with"] >= 1
    assert mine[0]["user_id"] == owner.id

    inbox = (await db_session.execute(
        select(Notification).where(
            Notification.user_id == owner.id,
            Notification.type == "weekly_recap",
        )
    )).scalars().all()
    assert len(inbox) == 1
    assert inbox[0].link == "/app/rankings"


@pytest.mark.asyncio
async def test_one_email_per_owner_covering_all_their_pets(db_session, captured_mail):
    owner, first = await _owner_with_voted_pet(db_session, likes=1, name="First")
    second = Pet(
        id=uuid.uuid4(), owner_id=owner.id, name="Second",
        species="dog", is_active=True,
    )
    db_session.add(second)
    await db_session.flush()
    voter = User(
        id=uuid.uuid4(), email=f"v2-{uuid.uuid4().hex[:8]}@t.dev",
        password_hash="x", display_name="V", is_active=True,
    )
    db_session.add(voter)
    await db_session.flush()
    db_session.add(Vote(
        voter_id=voter.id, pet_id=second.id, value=1,
        week_bucket=current_week_bucket() - timedelta(days=7),
    ))
    await db_session.commit()
    await _set_flag(db_session, True)

    await recap_task._run(session_factory)

    mine = [m for m in captured_mail if m["to"] == owner.email]
    assert len(mine) == 1
    names = {p["name"] for p in mine[0]["pets"]}
    assert names == {"First", "Second"}


# --- who is left out, and why ---


@pytest.mark.asyncio
async def test_respects_the_per_user_opt_out(db_session, captured_mail):
    owner, _ = await _owner_with_voted_pet(db_session)
    db_session.add(NotificationPreference(user_id=owner.id, weekly_recap=False))
    await db_session.commit()
    await _set_flag(db_session, True)

    await recap_task._run(session_factory)
    assert [m for m in captured_mail if m["to"] == owner.email] == []


@pytest.mark.asyncio
async def test_skips_pets_with_no_activity(db_session, captured_mail):
    """A recap saying nobody looked at your pet is worse than silence."""
    owner = User(
        id=uuid.uuid4(), email=f"quiet-{uuid.uuid4().hex[:8]}@t.dev",
        password_hash="x", display_name="Quiet", is_active=True,
    )
    db_session.add(owner)
    await db_session.flush()
    db_session.add(Pet(
        id=uuid.uuid4(), owner_id=owner.id, name="Unseen",
        species="dog", is_active=True,
    ))
    await db_session.commit()
    await _set_flag(db_session, True)

    await recap_task._run(session_factory)
    assert [m for m in captured_mail if m["to"] == owner.email] == []


@pytest.mark.asyncio
async def test_deactivated_owner_is_not_mailed(db_session, captured_mail):
    owner, _ = await _owner_with_voted_pet(db_session)
    owner.is_active = False
    await db_session.commit()
    await _set_flag(db_session, True)

    await recap_task._run(session_factory)
    assert [m for m in captured_mail if m["to"] == owner.email] == []


@pytest.mark.asyncio
async def test_no_email_provider_still_writes_the_inbox_entry(db_session):
    """The inbox is the primary channel; email is the second one."""
    from app.config import settings

    assert settings.RESEND_API_KEY == ""
    owner, _ = await _owner_with_voted_pet(db_session)
    await _set_flag(db_session, True)

    assert await recap_task._run(session_factory) == 0  # nothing emailed
    inbox = (await db_session.execute(
        select(Notification).where(
            Notification.user_id == owner.id,
            Notification.type == "weekly_recap",
        )
    )).scalars().all()
    assert len(inbox) == 1


# --- the numbers themselves ---


@pytest.mark.asyncio
async def test_rank_delta_reflects_movement(db_session, captured_mail):
    """A rank *number* going down is an improvement, so delta must be positive."""
    owner, pet = await _owner_with_voted_pet(db_session, likes=5, name="Climber")

    # Give another pet a better rank the week before, so Climber improves.
    rival_owner, rival = await _owner_with_voted_pet(db_session, likes=1, name="Rival")
    week_before = current_week_bucket() - timedelta(days=14)
    voters = []
    for _ in range(4):
        v = User(
            id=uuid.uuid4(), email=f"pv-{uuid.uuid4().hex[:8]}@t.dev",
            password_hash="x", display_name="V", is_active=True,
        )
        db_session.add(v)
        voters.append(v)
    await db_session.flush()
    # Rival was ahead last-last week; Climber was behind it.
    db_session.add(Vote(voter_id=voters[0].id, pet_id=rival.id, value=1, week_bucket=week_before))
    db_session.add(Vote(voter_id=voters[1].id, pet_id=rival.id, value=1, week_bucket=week_before))
    db_session.add(Vote(voter_id=voters[2].id, pet_id=pet.id, value=1, week_bucket=week_before))
    await db_session.commit()

    last_week = current_week_bucket() - timedelta(days=7)
    now = await get_week_standings(db_session, last_week)
    before = await get_week_standings(db_session, week_before)
    assert before[pet.id]["rank"] > now[pet.id]["rank"], "setup: Climber should improve"

    await _set_flag(db_session, True)
    await recap_task._run(session_factory)

    mine = [m for m in captured_mail if m["to"] == owner.email]
    row = next(p for p in mine[0]["pets"] if p["name"] == "Climber")
    assert row["delta"] == before[pet.id]["rank"] - now[pet.id]["rank"]
    assert row["delta"] > 0


@pytest.mark.asyncio
async def test_new_pets_report_no_delta(db_session, captured_mail):
    owner, _ = await _owner_with_voted_pet(db_session, likes=2, name="Newcomer")
    await _set_flag(db_session, True)

    await recap_task._run(session_factory)
    mine = [m for m in captured_mail if m["to"] == owner.email]
    row = next(p for p in mine[0]["pets"] if p["name"] == "Newcomer")
    # Unranked the week before → "new this week", not a fabricated 0.
    assert row["delta"] is None


# --- ties: RANK() gives every pet on the same score the same number ---


@pytest.mark.asyncio
async def test_tied_pets_are_reported_as_joint_not_outright(
    db_session, captured_mail
):
    """In a quiet week most pets tie, so a flat "#1" would tell dozens of
    owners they won while the crown goes to exactly one pet."""
    a_owner, _ = await _owner_with_voted_pet(db_session, likes=2, name="TieA")
    b_owner, _ = await _owner_with_voted_pet(db_session, likes=2, name="TieB")
    await _set_flag(db_session, True)

    await recap_task._run(session_factory)

    for owner, name in ((a_owner, "TieA"), (b_owner, "TieB")):
        mail = next(m for m in captured_mail if m["to"] == owner.email)
        row = next(p for p in mail["pets"] if p["name"] == name)
        assert row["rank"] == 1
        assert row["tied_with"] >= 2, "both pets share the top score"


@pytest.mark.asyncio
async def test_tied_copy_does_not_claim_an_outright_win():
    """Renders the real template — the task-level test above stubs it out, so
    without this the "#1 of N" arithmetic is never actually exercised."""
    import app.services.email as em

    captured = {}

    async def fake_send_email(to, subject, body_html, **kw):
        captured["subject"] = subject
        captured["html"] = body_html
        return True

    original = em.send_email
    em.send_email = fake_send_email
    try:
        await em.send_weekly_recap_email(
            "x@y.dev", user_id=uuid.uuid4(), week_label="Aug 3",
            pets=[{"name": "TieA", "species": "dog", "likes": 2,
                   "rank": 1, "tied_with": 7, "total": 9, "delta": None}],
        )
    finally:
        em.send_email = original

    assert "finished #1" not in captured["subject"]
    assert "tied for #1" in captured["subject"]
    assert "joint #1" in captured["html"]


@pytest.mark.asyncio
async def test_outright_winner_still_reads_as_a_win(db_session):
    """The celebratory copy must survive for a pet that genuinely won alone."""
    import app.services.email as em

    captured_html = {}

    async def fake_send_email(to, subject, body_html, **kw):
        captured_html["subject"] = subject
        captured_html["html"] = body_html
        return True

    original = em.send_email
    em.send_email = fake_send_email
    try:
        await em.send_weekly_recap_email(
            "x@y.dev", user_id=uuid.uuid4(), week_label="Aug 3",
            pets=[{"name": "Solo", "species": "dog", "likes": 9,
                   "rank": 1, "tied_with": 1, "total": 12, "delta": 2}],
        )
    finally:
        em.send_email = original

    assert "Solo finished #1 last week" in captured_html["subject"]
    assert "joint" not in captured_html["html"]
