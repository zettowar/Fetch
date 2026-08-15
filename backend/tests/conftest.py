import os
import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models import Base
from app.limiter import limiter

# Disable rate limiting in tests
limiter.enabled = False

# Tests run against an isolated database (dropped and recreated each session)
# so they never touch dev data. Defaults to "<dbname>_test" on the same server;
# override with TEST_DATABASE_URL.
_app_url = make_url(settings.DATABASE_URL)
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    _app_url.set(database=f"{_app_url.database}_test").render_as_string(hide_password=False),
)
_test_url = make_url(TEST_DATABASE_URL)
assert _test_url.database != _app_url.database, (
    "TEST_DATABASE_URL must not point at the application database"
)

# Create a test engine with NullPool to avoid connection sharing issues
test_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
test_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def _recreate_test_database():
    admin_engine = create_async_engine(
        _test_url.set(database="postgres").render_as_string(hide_password=False),
        poolclass=NullPool,
        isolation_level="AUTOCOMMIT",
    )
    async with admin_engine.connect() as conn:
        await conn.execute(
            text(f'DROP DATABASE IF EXISTS "{_test_url.database}" WITH (FORCE)')
        )
        await conn.execute(text(f'CREATE DATABASE "{_test_url.database}"'))
    await admin_engine.dispose()


async def get_test_db():
    async with test_session_factory() as session:
        yield session


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def setup_db():
    from sqlalchemy import func, select
    from app.breed_data import BREED_SEED, slugify
    from app.models.breed import Breed

    await _recreate_test_database()
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed a handful of breeds so tests can reference them (idempotent)
    async with test_session_factory() as db:
        existing = (await db.execute(select(func.count()).select_from(Breed))).scalar() or 0
        if existing == 0:
            for name, group in BREED_SEED[:10]:
                db.add(Breed(name=name, slug=slugify(name), group=group))
            await db.commit()
    yield
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session(setup_db):
    """A session against the test database, for tests that need to set up rows
    or call a service directly rather than going through the API.

    Deliberately NOT loop_scope="session": the session is opened and closed
    inside the test's own event loop, otherwise asyncpg's connection teardown
    runs on a different loop and raises at fixture exit.
    """
    async with test_session_factory() as session:
        yield session


@pytest_asyncio.fixture(loop_scope="session")
async def client(setup_db):
    from app.main import app
    from app.db import get_db

    app.dependency_overrides[get_db] = get_test_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture(loop_scope="session")
async def auth_headers(client: AsyncClient):
    """Create a test user and return auth headers."""
    email = f"test-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "testpass123",
        "display_name": "Test User",
    })
    assert res.status_code == 201, res.text
    token = res.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(loop_scope="session")
async def admin_headers(client: AsyncClient):
    """Create a user and promote to admin, return auth headers."""
    from sqlalchemy import update
    from app.models.user import User

    email = f"admin-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": "testpass123",
        "display_name": "Test Admin",
    })
    assert res.status_code == 201, res.text
    user_id = res.json()["user"]["id"]
    token = res.json()["tokens"]["access_token"]

    # Promote to admin using the test engine (not the app's engine)
    async with test_session_factory() as db:
        await db.execute(update(User).where(User.id == user_id).values(role="admin"))
        await db.commit()

    return {"Authorization": f"Bearer {token}"}
