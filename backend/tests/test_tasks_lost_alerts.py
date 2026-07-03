"""Coverage for the lost-dog proximity-alert Celery task.

We exercise the underlying async helper `_send_alerts` directly — the Celery
wrapper is a 1-line `asyncio.run()` shim. The helper takes an injectable
session factory so we can point it at the isolated test database.
"""
import logging
import uuid

import pytest
from httpx import AsyncClient

from app.models.lost_report import LostReportSubscription
from app.tasks.lost_alerts import _send_alerts
from tests.conftest import test_session_factory


async def _make_user(client: AsyncClient) -> tuple[str, dict]:
    email = f"alerts-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    res = await client.post("/api/v1/auth/signup", json={
        "email": email, "password": "password123", "display_name": "Alerts",
    })
    assert res.status_code == 201
    return res.json()["user"]["id"], {
        "Authorization": f"Bearer {res.json()['tokens']['access_token']}"
    }


@pytest.mark.asyncio
async def test_send_alerts_excludes_reporter_and_out_of_radius(
    client: AsyncClient, caplog
):
    reporter_id, reporter_headers = await _make_user(client)
    in_range_id, _ = await _make_user(client)
    far_away_id, _ = await _make_user(client)

    # Reporter creates a missing report at SF City Hall.
    create = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "Coverage test report",
        "last_seen_lat": 37.7793,
        "last_seen_lng": -122.4193,
    }, headers=reporter_headers)
    assert create.status_code == 201
    report_id = create.json()["id"]

    # Subscriptions: reporter (must be filtered out), nearby user, far user.
    async with test_session_factory() as db:
        db.add(LostReportSubscription(
            user_id=uuid.UUID(reporter_id),
            home_lat=37.78, home_lng=-122.42, radius_km=10,
        ))
        db.add(LostReportSubscription(
            user_id=uuid.UUID(in_range_id),
            home_lat=37.78, home_lng=-122.42, radius_km=10,
        ))
        # Sydney — well outside any reasonable radius.
        db.add(LostReportSubscription(
            user_id=uuid.UUID(far_away_id),
            home_lat=-33.87, home_lng=151.21, radius_km=10,
        ))
        await db.commit()

    caplog.set_level(logging.INFO, logger="app.tasks.lost_alerts")
    await _send_alerts(report_id, session_factory=test_session_factory)

    # Reporter must not appear in any "Would notify user X" log line.
    notified_lines = [r.message for r in caplog.records if "Would notify user" in r.message]
    assert any(in_range_id in line for line in notified_lines), notified_lines
    assert not any(reporter_id in line for line in notified_lines), notified_lines
    assert not any(far_away_id in line for line in notified_lines), notified_lines


@pytest.mark.asyncio
async def test_send_alerts_no_coords_short_circuits(client: AsyncClient, caplog):
    _, headers = await _make_user(client)
    create = await client.post("/api/v1/lost/reports", json={
        "kind": "missing",
        "description": "No coords",
    }, headers=headers)
    report_id = create.json()["id"]

    caplog.set_level(logging.INFO, logger="app.tasks.lost_alerts")
    await _send_alerts(report_id, session_factory=test_session_factory)
    assert any("no coordinates" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_send_alerts_missing_report_is_a_noop(caplog):
    caplog.set_level(logging.INFO, logger="app.tasks.lost_alerts")
    # Random UUID with no matching row.
    await _send_alerts(str(uuid.uuid4()), session_factory=test_session_factory)
    assert any("not found" in r.message for r in caplog.records)
