"""Permission + audit-trail coverage for the billing grant endpoint."""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models.audit_log import AuditLog


@pytest.mark.asyncio
async def test_grant_requires_admin(client: AsyncClient, auth_headers: dict):
    res = await client.post("/api/v1/billing/grant", json={
        "user_id": str(uuid.uuid4()),
        "entitlement_key": "ads_removed",
        "source": "manual_grant",
    }, headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_grant_unknown_user_returns_404(client: AsyncClient, admin_headers: dict):
    res = await client.post("/api/v1/billing/grant", json={
        "user_id": str(uuid.uuid4()),
        "entitlement_key": "ads_removed",
        "source": "manual_grant",
    }, headers=admin_headers)
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_grant_writes_audit_log(client: AsyncClient, admin_headers: dict):
    from tests.conftest import test_session_factory

    # New user to grant to.
    email = f"grantee-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    s = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Grantee",
    })
    user_id = s.json()["user"]["id"]

    res = await client.post("/api/v1/billing/grant", json={
        "user_id": user_id,
        "entitlement_key": "ads_removed",
        "source": "beta_tester",
    }, headers=admin_headers)
    assert res.status_code == 201

    async with test_session_factory() as db:
        rows = (await db.execute(
            select(AuditLog).where(
                AuditLog.action == "entitlement.grant",
                AuditLog.target_id == uuid.UUID(user_id),
            )
        )).scalars().all()
        assert len(rows) == 1
        assert rows[0].metadata_ == {
            "entitlement_key": "ads_removed",
            "source": "beta_tester",
        }
