"""Readiness probe: DB reachability + uploads-storage writability.

The storage leg exists because a non-writable uploads volume (root-owned by a
dev-stack `up`, say) breaks every photo upload while the app otherwise looks
healthy — readiness failing is what makes `up --wait` refuse to ship it.
"""
import pytest
from httpx import AsyncClient

from app.db import engine
from app.storage import LocalStorage


async def _discard_stale_pool():
    """Drop the global engine's pooled connections before probing /readyz.

    /readyz deliberately uses the app's global engine, not the test-session DI
    override — so its pool caches connections bound to whichever event loop ran
    first. pytest-asyncio gives every test a fresh loop, and a pooled asyncpg
    connection from a previous loop makes the DB leg fail. close=False discards
    the pool without awaiting cross-loop closes.
    """
    await engine.dispose(close=False)


@pytest.mark.asyncio
async def test_readyz_ok(client: AsyncClient):
    await _discard_stale_pool()
    res = await client.get("/readyz")
    assert res.status_code == 200
    assert res.json() == {"status": "ready"}


@pytest.mark.asyncio
async def test_readyz_503_when_storage_unwritable(client: AsyncClient, monkeypatch):
    async def denied_put(self, key, data, content_type):
        raise PermissionError(13, "Permission denied", f"/app/uploads/{key}")

    monkeypatch.setattr(LocalStorage, "put", denied_put)
    await _discard_stale_pool()
    res = await client.get("/readyz")
    assert res.status_code == 503
    assert res.json() == {"status": "unavailable", "reason": "storage"}


@pytest.mark.asyncio
async def test_readyz_probe_leaves_no_file_behind(client: AsyncClient, monkeypatch, tmp_path):
    monkeypatch.setattr("app.config.settings.STORAGE_LOCAL_PATH", str(tmp_path))
    await _discard_stale_pool()
    res = await client.get("/readyz")
    assert res.status_code == 200
    assert list(tmp_path.iterdir()) == []
