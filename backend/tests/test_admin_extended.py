import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_stats(client: AsyncClient, admin_headers: dict):
    res = await client.get("/api/v1/admin/stats", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_users" in data
    assert "pending_reports" in data
    assert "open_tickets" in data
    assert isinstance(data["total_users"], int)


@pytest.mark.asyncio
async def test_dashboard_requires_admin(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/admin/stats", headers=auth_headers)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_search_users(client: AsyncClient, admin_headers: dict):
    res = await client.get("/api/v1/admin/users/search", params={"q": "test"}, headers=admin_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_get_user_detail(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    me = await client.get("/api/v1/auth/me", headers=auth_headers)
    user_id = me.json()["id"]

    res = await client.get(f"/api/v1/admin/users/{user_id}", headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["id"] == user_id
    assert "dog_count" in res.json()
    assert "strike_count" in res.json()


@pytest.mark.asyncio
async def test_faq_crud(client: AsyncClient, admin_headers: dict):
    # Create
    res = await client.post("/api/v1/admin/faq", json={
        "question": "How do I upload a photo?",
        "answer": "Go to your dog's profile and tap the upload area.",
        "category": "getting_started",
    }, headers=admin_headers)
    assert res.status_code == 201
    faq_id = res.json()["id"]

    # Update
    res2 = await client.patch(f"/api/v1/admin/faq/{faq_id}", json={
        "answer": "Updated answer with more detail.",
    }, headers=admin_headers)
    assert res2.status_code == 200
    assert res2.json()["answer"] == "Updated answer with more detail."

    # Delete
    res3 = await client.delete(f"/api/v1/admin/faq/{faq_id}", headers=admin_headers)
    assert res3.status_code == 200


@pytest.mark.asyncio
async def test_ticket_update(client: AsyncClient, admin_headers: dict, auth_headers: dict):
    # Create a ticket as regular user
    ticket_res = await client.post("/api/v1/support/tickets", json={
        "subject": "Admin test ticket",
        "body": "Testing ticket update",
    }, headers=auth_headers)
    ticket_id = ticket_res.json()["id"]

    # Update as admin
    res = await client.post(f"/api/v1/admin/tickets/{ticket_id}/update", json={
        "status": "resolved",
    }, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "resolved"


@pytest.mark.asyncio
async def test_admin_rescues_list(client: AsyncClient, admin_headers: dict):
    res = await client.get("/api/v1/admin/rescues", headers=admin_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
