"""One-click unsubscribe (RFC 8058) + email delivery instrumentation.

Bulk mail previously carried no opt-out at all: a CASL exposure in the markets
this product targets, and a deliverability problem regardless — Gmail and Yahoo
require List-Unsubscribe from bulk senders, and losing sender reputation would
take password resets and lost-pet alerts down with the marketing.
"""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.notification import NotificationPreference
from app.models.user import User
from app.security import create_unsubscribe_token
from app.services import email as email_service


async def _user(db_session) -> User:
    u = User(
        id=uuid.uuid4(), email=f"unsub-{uuid.uuid4().hex[:8]}@t.dev",
        password_hash="x", display_name="Unsub", is_active=True,
    )
    db_session.add(u)
    await db_session.commit()
    return u


async def _prefs(db_session, user_id) -> NotificationPreference:
    return (await db_session.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
    )).scalar_one()


# --- the endpoint ---


@pytest.mark.asyncio
async def test_one_click_post_opts_out_of_the_digest(
    client: AsyncClient, db_session
):
    """A mail client POSTs this with no session and no CSRF token."""
    user = await _user(db_session)
    db_session.add(NotificationPreference(user_id=user.id, digest_mode="daily"))
    await db_session.commit()

    token = create_unsubscribe_token(str(user.id), "digest")
    res = await client.post(f"/api/v1/public/unsubscribe/{token}")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    await db_session.refresh(await _prefs(db_session, user.id))
    assert (await _prefs(db_session, user.id)).digest_mode == "off"


@pytest.mark.asyncio
async def test_link_click_works_too(client: AsyncClient, db_session):
    user = await _user(db_session)
    db_session.add(NotificationPreference(user_id=user.id))
    await db_session.commit()

    token = create_unsubscribe_token(str(user.id), "announcements")
    res = await client.get(f"/api/v1/public/unsubscribe/{token}")
    assert res.status_code == 200
    assert (await _prefs(db_session, user.id)).announcement_emails is False


@pytest.mark.asyncio
async def test_creates_prefs_row_when_the_user_never_opened_settings(
    client: AsyncClient, db_session
):
    """No row must not mean 'silently keep mailing them'."""
    user = await _user(db_session)
    token = create_unsubscribe_token(str(user.id), "lost_alerts")

    res = await client.post(f"/api/v1/public/unsubscribe/{token}")
    assert res.status_code == 200
    assert (await _prefs(db_session, user.id)).lost_dog_alerts is False


@pytest.mark.asyncio
@pytest.mark.parametrize("token", ["garbage", "a.b.c"])
async def test_rejects_unsigned_tokens(client: AsyncClient, token):
    res = await client.post(f"/api/v1/public/unsubscribe/{token}")
    assert res.status_code == 200
    assert res.json()["status"] == "invalid"


@pytest.mark.asyncio
async def test_rejects_an_unknown_list(client: AsyncClient, db_session):
    user = await _user(db_session)
    token = create_unsubscribe_token(str(user.id), "not-a-list")
    res = await client.post(f"/api/v1/public/unsubscribe/{token}")
    assert res.json()["status"] == "invalid"


@pytest.mark.asyncio
async def test_a_token_only_ever_turns_things_off(client: AsyncClient, db_session):
    """Worst case for a leaked token is the named user gets fewer emails."""
    user = await _user(db_session)
    db_session.add(NotificationPreference(
        user_id=user.id, digest_mode="daily", lost_dog_alerts=True,
    ))
    await db_session.commit()

    token = create_unsubscribe_token(str(user.id), "digest")
    await client.post(f"/api/v1/public/unsubscribe/{token}")
    prefs = await _prefs(db_session, user.id)
    # Only the named list changed; the others are untouched.
    assert prefs.digest_mode == "off"
    assert prefs.lost_dog_alerts is True
    assert prefs.announcement_emails is True


# --- headers on the wire ---


@pytest.mark.asyncio
async def test_bulk_sends_carry_one_click_headers(monkeypatch):
    captured: dict = {}

    class _Resp:
        status_code = 200
        text = "{}"

    class _Client:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, headers=None, json=None):
            captured.update(json or {})
            return _Resp()

    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(email_service.httpx, "AsyncClient", _Client)

    uid = uuid.uuid4()
    await email_service.send_email(
        "a@b.dev", "Subject", "<p>hi</p>",
        headers=email_service.unsubscribe_headers(uid, "digest"),
        kind="digest",
    )
    sent = captured["headers"]
    assert sent["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert "/unsubscribe/" in sent["List-Unsubscribe"]
    assert "mailto:" in sent["List-Unsubscribe"]


@pytest.mark.asyncio
async def test_transactional_mail_carries_no_unsubscribe(monkeypatch):
    """An opt-out link on a password reset is nonsense (and non-compliant)."""
    captured: dict = {}

    class _Resp:
        status_code = 200
        text = "{}"

    class _Client:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, headers=None, json=None):
            captured.update(json or {})
            return _Resp()

    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(email_service.httpx, "AsyncClient", _Client)

    await email_service.send_password_reset_email("a@b.dev", "tok")
    assert "headers" not in captured
    assert "unsubscribe" not in captured["html"].lower()


# --- instrumentation ---


def _counter_value(kind: str, outcome: str) -> float:
    return (
        email_service.EMAIL_SENDS.labels(kind=kind, outcome=outcome)._value.get()
    )


@pytest.mark.asyncio
async def test_failures_are_counted_per_kind(monkeypatch):
    """The point: a single broken flow is visible without reading logs."""
    class _Client:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, *a, **k):
            raise RuntimeError("connection refused")

    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(email_service.httpx, "AsyncClient", _Client)

    before = _counter_value("transfer_invite", "unreachable")
    ok = await email_service.send_email(
        "a@b.dev", "s", "<p>x</p>", kind="transfer_invite"
    )
    assert ok is False
    assert _counter_value("transfer_invite", "unreachable") == before + 1


@pytest.mark.asyncio
async def test_missing_provider_is_counted_separately(monkeypatch):
    """A never-configured key must not look like a provider outage."""
    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "")
    before = _counter_value("digest", "skipped_no_provider")
    await email_service.send_email("a@b.dev", "s", "<p>x</p>", kind="digest")
    assert _counter_value("digest", "skipped_no_provider") == before + 1


@pytest.mark.asyncio
async def test_metrics_endpoint_exposes_the_counter(client: AsyncClient, monkeypatch):
    monkeypatch.setattr(email_service.settings, "RESEND_API_KEY", "")
    await email_service.send_email("a@b.dev", "s", "<p>x</p>", kind="verification")
    res = await client.get("/metrics")
    assert res.status_code == 200
    assert "fetchpawz_email_sends_total" in res.text
