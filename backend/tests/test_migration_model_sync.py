"""Migrated schema must match the SQLAlchemy models.

The rest of the suite builds its schema with create_all (from the models), so
drift between the migration chain and the models is invisible to it — this is
how the weekly_winners.dog_id NOT NULL bug slipped through. Here we upgrade a
scratch database to head and diff it against Base.metadata.
"""

import asyncio
import os
import subprocess
from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models import Base

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _url(url) -> str:
    return url.render_as_string(hide_password=False)


async def _recreate_scratch_db(scratch_url) -> None:
    admin_engine = create_async_engine(
        _url(scratch_url.set(database="postgres")),
        poolclass=NullPool,
        isolation_level="AUTOCOMMIT",
    )
    async with admin_engine.connect() as conn:
        await conn.execute(
            text(f'DROP DATABASE IF EXISTS "{scratch_url.database}" WITH (FORCE)')
        )
        await conn.execute(text(f'CREATE DATABASE "{scratch_url.database}"'))
    await admin_engine.dispose()


async def _diff_against_models(scratch_url) -> list:
    engine = create_async_engine(_url(scratch_url), poolclass=NullPool)
    try:
        async with engine.connect() as conn:
            return await conn.run_sync(
                lambda sync_conn: compare_metadata(
                    MigrationContext.configure(sync_conn), Base.metadata
                )
            )
    finally:
        await engine.dispose()


def test_migrations_match_models():
    app_url = make_url(settings.DATABASE_URL)
    scratch_url = app_url.set(database=f"{app_url.database}_migration_check")

    asyncio.run(_recreate_scratch_db(scratch_url))

    env = dict(os.environ, DATABASE_URL=_url(scratch_url))
    proc = subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, (
        f"alembic upgrade head failed:\n{proc.stdout}\n{proc.stderr}"
    )

    diffs = asyncio.run(_diff_against_models(scratch_url))
    assert not diffs, "Migrated schema differs from models:\n" + "\n".join(
        str(d) for d in diffs
    )
