"""Coverage for moderation.check_image error / threshold paths.

The default test config has no Sightengine credentials, so we monkeypatch
both the settings and `httpx.AsyncClient` to exercise each branch.
"""
import httpx
import pytest

from app.services import moderation as mod
from app.services.moderation import check_image


class _FakeResponse:
    def __init__(self, payload: dict):
        self._payload = payload

    def json(self):
        return self._payload


class _FakeClient:
    """Drop-in replacement for `httpx.AsyncClient` used as an async ctx mgr."""

    def __init__(self, *, response=None, raise_exc: Exception | None = None, **kwargs):
        self._response = response
        self._raise = raise_exc

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, *args, **kwargs):
        if self._raise is not None:
            raise self._raise
        return self._response


@pytest.fixture
def with_creds(monkeypatch):
    monkeypatch.setattr(mod.settings, "SIGHTENGINE_API_USER", "u")
    monkeypatch.setattr(mod.settings, "SIGHTENGINE_API_SECRET", "s")


def _patch_httpx(monkeypatch, *, payload=None, raise_exc=None):
    def factory(*args, **kwargs):
        return _FakeClient(
            response=_FakeResponse(payload) if payload is not None else None,
            raise_exc=raise_exc,
        )

    monkeypatch.setattr(httpx, "AsyncClient", factory)


@pytest.mark.asyncio
async def test_timeout_fails_closed_to_flagged(with_creds, monkeypatch):
    _patch_httpx(monkeypatch, raise_exc=httpx.TimeoutException("slow"))
    result = await check_image(b"x")
    assert result.status == "flagged"
    assert result.reason == "timeout_fallback"


@pytest.mark.asyncio
async def test_unexpected_error_fails_closed_to_flagged(with_creds, monkeypatch):
    _patch_httpx(monkeypatch, raise_exc=RuntimeError("boom"))
    result = await check_image(b"x")
    assert result.status == "flagged"
    assert result.reason == "error_fallback"


@pytest.mark.asyncio
async def test_api_error_status_fails_closed_to_flagged(with_creds, monkeypatch):
    _patch_httpx(monkeypatch, payload={"status": "failure", "error": "nope"})
    result = await check_image(b"x")
    assert result.status == "flagged"
    assert result.reason == "api_error_fallback"


@pytest.mark.asyncio
async def test_nudity_flag(with_creds, monkeypatch):
    _patch_httpx(monkeypatch, payload={
        "status": "success",
        "nudity": {"sexual_activity": 0.9, "sexual_display": 0.0},
        "offensive": {"prob": 0.0},
        "gore": {"prob": 0.0},
    })
    result = await check_image(b"x")
    assert result.status == "flagged"
    assert result.reason == "nudity"


@pytest.mark.asyncio
async def test_offensive_flag(with_creds, monkeypatch):
    _patch_httpx(monkeypatch, payload={
        "status": "success",
        "nudity": {"sexual_activity": 0.0, "sexual_display": 0.0},
        "offensive": {"prob": 0.95},
        "gore": {"prob": 0.0},
    })
    result = await check_image(b"x")
    assert result.status == "flagged"
    assert result.reason == "offensive"


@pytest.mark.asyncio
async def test_gore_flag(with_creds, monkeypatch):
    _patch_httpx(monkeypatch, payload={
        "status": "success",
        "nudity": {"sexual_activity": 0.0, "sexual_display": 0.0},
        "offensive": {"prob": 0.0},
        "gore": {"prob": 0.8},
    })
    result = await check_image(b"x")
    assert result.status == "flagged"
    assert result.reason == "gore"


@pytest.mark.asyncio
async def test_clean_image_approved(with_creds, monkeypatch):
    _patch_httpx(monkeypatch, payload={
        "status": "success",
        "nudity": {"sexual_activity": 0.0, "sexual_display": 0.0},
        "offensive": {"prob": 0.0},
        "gore": {"prob": 0.0},
    })
    result = await check_image(b"x")
    assert result.status == "approved"
    assert result.reason is None
