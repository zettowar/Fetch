import uuid

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models import Base
from app.limiter import limiter

# Disable rate limiting in tests
limiter.enabled = False

# Create a test engine with NullPool to avoid connection sharing issues
test_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
test_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


async def get_test_db():
    async with test_session_factory() as session:
        yield session


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await test_engine.dispose()


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
