"""Coverage for the Resend email service and the flows wired to it."""
import uuid

import httpx
import pytest
from httpx import AsyncClient

import app.routers.auth as auth_router
from app.config import settings
from app.services import email as email_service


# --- send_email unit behavior ---

@pytest.mark.asyncio
async def test_send_email_skipped_without_key():
    assert settings.RESEND_API_KEY == ""
    assert await email_service.send_email("a@b.dev", "Hi", "<p>hi</p>") is False


@pytest.mark.asyncio
async def test_send_email_posts_to_resend(monkeypatch):
    captured: dict = {}

    class _Resp:
        status_code = 200
        text = "{}"

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, headers=None, json=None):
            captured.update({"url": url, "headers": headers, "json": json})
            return _Resp()

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(httpx, "AsyncClient", _Client)

    ok = await email_service.send_email(
        "who@example.dev", "Subject", "<p>body</p>", reply_to="sender@example.dev"
    )
    assert ok is True
    assert captured["url"] == email_service.RESEND_API_URL
    assert captured["headers"]["Authorization"] == "Bearer re_test_key"
    assert captured["json"]["to"] == ["who@example.dev"]
    assert captured["json"]["from"] == settings.EMAIL_FROM
    assert captured["json"]["reply_to"] == ["sender@example.dev"]


@pytest.mark.asyncio
async def test_send_email_swallows_provider_errors(monkeypatch):
    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, *args, **kwargs):
            raise httpx.ConnectError("boom")

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(httpx, "AsyncClient", _Client)
    # Must not raise — email failures can't break the calling request.
    assert await email_service.send_email("a@b.dev", "Hi", "<p>hi</p>") is False


# --- Flow wiring ---

async def _signup(client: AsyncClient) -> tuple[str, dict]:
    email = f"mail-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Mail User",
    })
    assert res.status_code == 201, res.text
    return email, {"Authorization": f"Bearer {res.json()['tokens']['access_token']}"}


@pytest.mark.asyncio
async def test_forgot_password_sends_reset_email(client: AsyncClient, monkeypatch):
    email, _ = await _signup(client)

    sent: list[tuple[str, str]] = []

    async def fake_send(to, raw_token):
        sent.append((to, raw_token))
        return True

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(auth_router, "send_password_reset_email", fake_send)

    res = await client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert res.status_code == 200

    assert len(sent) == 1
    assert sent[0][0] == email

    # The emailed token really works end-to-end.
    reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": sent[0][1], "password": "newpassword456"},
    )
    assert reset.status_code == 200, reset.text
    login = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": "newpassword456"}
    )
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_forgot_password_unknown_email_sends_nothing(client: AsyncClient, monkeypatch):
    sent: list = []

    async def fake_send(to, raw_token):
        sent.append(to)
        return True

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(auth_router, "send_password_reset_email", fake_send)

    res = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": f"ghost-{uuid.uuid4().hex[:6]}@fetchapp.dev"},
    )
    assert res.status_code == 200  # same body as the known-email path
    assert sent == []


@pytest.mark.asyncio
async def test_signup_sends_verification_email(client: AsyncClient, monkeypatch):
    sent: list[tuple[str, str]] = []

    async def fake_send(to, raw_token):
        sent.append((to, raw_token))
        return True

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr(auth_router, "send_verification_email", fake_send)

    email, headers = await _signup(client)
    assert len(sent) == 1
    assert sent[0][0] == email

    # The emailed token verifies the account.
    verify = await client.post("/api/v1/auth/verify-email", json={"token": sent[0][1]})
    assert verify.status_code == 200, verify.text
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.json()["is_verified"] is True


@pytest.mark.asyncio
async def test_signup_without_provider_mints_no_verification_token(client: AsyncClient):
    """Unconfigured email keeps the old behavior: no token row is created."""
    from sqlalchemy import select
    from tests.conftest import test_session_factory
    from app.models.user import EmailVerificationToken, User

    email, _ = await _signup(client)
    async with test_session_factory() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one()
        tokens = (await db.execute(
            select(EmailVerificationToken).where(
                EmailVerificationToken.user_id == user.id
            )
        )).scalars().all()
    assert tokens == []


@pytest.mark.asyncio
async def test_lost_alerts_email_subscribers(client: AsyncClient, monkeypatch):
    from app.models.lost_report import LostReportSubscription
    from app.tasks.lost_alerts import _send_alerts
    from tests.conftest import test_session_factory

    reporter_email, reporter_headers = await _signup(client)
    subscriber_email, _ = await _signup(client)

    create = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Alert email test",
        "last_seen_lat": 37.7793,
        "last_seen_lng": -122.4193,
    }, headers=reporter_headers)
    assert create.status_code == 201
    report_id = create.json()["id"]

    from sqlalchemy import select
    from app.models.user import User
    async with test_session_factory() as db:
        sub_user = (await db.execute(
            select(User).where(User.email == subscriber_email)
        )).scalar_one()
        db.add(LostReportSubscription(
            user_id=sub_user.id, home_lat=37.78, home_lng=-122.42, radius_km=10,
        ))
        await db.commit()

    sent: list[str] = []

    async def fake_alert(to, **kwargs):
        sent.append(to)
        return True

    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test_key")
    monkeypatch.setattr("app.services.email.send_lost_alert_email", fake_alert)

    await _send_alerts(report_id, session_factory=test_session_factory)

    assert subscriber_email in sent
    assert reporter_email not in sent
