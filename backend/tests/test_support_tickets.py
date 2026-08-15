"""Support tickets as a two-way conversation.

Before this existed a ticket was write-only: the reporter sent a message, staff
set a status and wrote an internal note, and nothing ever came back. These tests
pin the two properties that make it a conversation — a reply reaches the
reporter, and an internal note never does.
"""
import uuid

import pytest
from httpx import AsyncClient


async def _file_ticket(client: AsyncClient, headers: dict, subject="Help me") -> dict:
    res = await client.post(
        "/api/v1/support/tickets",
        json={"subject": subject, "body": "Something is wrong."},
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()


@pytest.mark.asyncio
async def test_a_staff_reply_reaches_the_reporter(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    ticket = await _file_ticket(client, auth_headers)

    res = await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/reply",
        json={"body": "Here is the answer."},
        headers=admin_headers,
    )
    assert res.status_code == 201, res.text

    thread = await client.get(
        f"/api/v1/support/tickets/{ticket['id']}", headers=auth_headers
    )
    assert thread.status_code == 200
    body = thread.json()
    assert [m["body"] for m in body["messages"]] == ["Here is the answer."]
    assert body["messages"][0]["author_role"] == "staff"


@pytest.mark.asyncio
async def test_the_reply_also_lands_in_the_in_app_inbox(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """Email can silently fail; the inbox is the channel we control."""
    ticket = await _file_ticket(client, auth_headers, subject="Inbox check")
    await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/reply",
        json={"body": "Answered."},
        headers=admin_headers,
    )

    res = await client.get("/api/v1/notifications/inbox", headers=auth_headers)
    assert res.status_code == 200, res.text
    payload = res.json()
    items = payload if isinstance(payload, list) else payload["items"]
    replies = [n for n in items if n["type"] == "support_reply"]
    assert len(replies) == 1
    assert replies[0]["link"] == f"/app/support/tickets/{ticket['id']}"


@pytest.mark.asyncio
async def test_internal_notes_never_reach_the_reporter(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """The whole point of keeping notes and replies as separate fields."""
    ticket = await _file_ticket(client, auth_headers)
    secret = "internal: likely a chargeback risk"

    await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/update",
        json={"status": "in_progress", "admin_notes": secret},
        headers=admin_headers,
    )

    thread = await client.get(
        f"/api/v1/support/tickets/{ticket['id']}", headers=auth_headers
    )
    assert secret not in thread.text
    assert "admin_notes" not in thread.json()

    listing = await client.get("/api/v1/support/tickets/mine", headers=auth_headers)
    assert secret not in listing.text


@pytest.mark.asyncio
async def test_which_staff_member_replied_is_not_disclosed(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    ticket = await _file_ticket(client, auth_headers)
    await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/reply",
        json={"body": "Answered."},
        headers=admin_headers,
    )

    thread = await client.get(
        f"/api/v1/support/tickets/{ticket['id']}", headers=auth_headers
    )
    message = thread.json()["messages"][0]
    assert "author_id" not in message
    assert "author_name" not in message

    # Staff, by contrast, need to know who said what.
    staff_view = await client.get(
        f"/api/v1/admin/tickets/{ticket['id']}", headers=admin_headers
    )
    assert staff_view.json()["messages"][0]["author_name"] == "Test Admin"


@pytest.mark.asyncio
async def test_unread_count_tracks_staff_replies_until_the_thread_is_opened(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    ticket = await _file_ticket(client, auth_headers, subject="Unread check")

    before = await client.get(
        "/api/v1/support/tickets/unread-count", headers=auth_headers
    )
    baseline = before.json()["unread"]

    await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/reply",
        json={"body": "One."},
        headers=admin_headers,
    )
    after = await client.get(
        "/api/v1/support/tickets/unread-count", headers=auth_headers
    )
    assert after.json()["unread"] == baseline + 1

    await client.get(f"/api/v1/support/tickets/{ticket['id']}", headers=auth_headers)

    cleared = await client.get(
        "/api/v1/support/tickets/unread-count", headers=auth_headers
    )
    assert cleared.json()["unread"] == baseline


@pytest.mark.asyncio
async def test_the_reporters_own_reply_does_not_count_as_unread(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    ticket = await _file_ticket(client, auth_headers)
    await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/reply",
        json={"body": "Staff answer."},
        headers=admin_headers,
    )
    await client.get(f"/api/v1/support/tickets/{ticket['id']}", headers=auth_headers)

    await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/messages",
        json={"body": "Thanks!"},
        headers=auth_headers,
    )

    res = await client.get("/api/v1/support/tickets/mine", headers=auth_headers)
    mine = next(t for t in res.json() if t["id"] == ticket["id"])
    assert mine["unread_count"] == 0
    assert mine["reply_count"] == 2


@pytest.mark.asyncio
async def test_replying_to_a_resolved_ticket_reopens_it(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """'Resolved' must not be a place a still-stuck person cannot escape."""
    ticket = await _file_ticket(client, auth_headers)
    await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/reply",
        json={"body": "Try this.", "status": "resolved"},
        headers=admin_headers,
    )

    res = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/messages",
        json={"body": "That did not work."},
        headers=auth_headers,
    )
    assert res.status_code == 201, res.text

    thread = await client.get(
        f"/api/v1/support/tickets/{ticket['id']}", headers=auth_headers
    )
    assert thread.json()["status"] == "open"

    # ...and it goes back into the queue staff actually work from.
    queue = await client.get(
        "/api/v1/support/tickets?status_filter=all&awaiting=true", headers=admin_headers
    )
    assert ticket["id"] in [t["id"] for t in queue.json()]


@pytest.mark.asyncio
async def test_a_closed_ticket_refuses_new_replies(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    ticket = await _file_ticket(client, auth_headers)
    await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/update",
        json={"status": "closed"},
        headers=admin_headers,
    )

    res = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/messages",
        json={"body": "Still there?"},
        headers=auth_headers,
    )
    assert res.status_code == 409
    assert "closed" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_a_status_change_notifies_the_reporter(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    ticket = await _file_ticket(client, auth_headers, subject="Status check")
    await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/update",
        json={"status": "resolved"},
        headers=admin_headers,
    )

    res = await client.get("/api/v1/notifications/inbox", headers=auth_headers)
    payload = res.json()
    items = payload if isinstance(payload, list) else payload["items"]
    assert any(n["type"] == "support_status" for n in items)


@pytest.mark.asyncio
async def test_a_staff_reply_takes_the_ticket_out_of_the_awaiting_queue(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    ticket = await _file_ticket(client, auth_headers)

    queue = await client.get(
        "/api/v1/support/tickets?status_filter=all&awaiting=true", headers=admin_headers
    )
    assert ticket["id"] in [t["id"] for t in queue.json()]

    await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/reply",
        json={"body": "On it."},
        headers=admin_headers,
    )

    queue = await client.get(
        "/api/v1/support/tickets?status_filter=all&awaiting=true", headers=admin_headers
    )
    assert ticket["id"] not in [t["id"] for t in queue.json()]


@pytest.mark.asyncio
async def test_answering_an_untouched_ticket_marks_it_in_progress(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    ticket = await _file_ticket(client, auth_headers)
    assert ticket["status"] == "open"

    res = await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/reply",
        json={"body": "Looking into it."},
        headers=admin_headers,
    )
    assert res.status_code == 201

    staff_view = await client.get(
        f"/api/v1/admin/tickets/{ticket['id']}", headers=admin_headers
    )
    assert staff_view.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_one_user_cannot_read_or_reply_to_anothers_ticket(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    ticket = await _file_ticket(client, auth_headers)

    email = f"nosy-{uuid.uuid4().hex[:8]}@fetchapp.dev"
    signup = await client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "testpass123", "display_name": "Nosy"},
    )
    other = {"Authorization": f"Bearer {signup.json()['tokens']['access_token']}"}

    # 404 not 403 — a 403 would confirm the ticket exists.
    assert (
        await client.get(f"/api/v1/support/tickets/{ticket['id']}", headers=other)
    ).status_code == 404
    assert (
        await client.post(
            f"/api/v1/support/tickets/{ticket['id']}/messages",
            json={"body": "hi"},
            headers=other,
        )
    ).status_code == 404


@pytest.mark.asyncio
async def test_a_regular_user_cannot_reply_as_staff(
    client: AsyncClient, auth_headers: dict
):
    ticket = await _file_ticket(client, auth_headers)
    res = await client.post(
        f"/api/v1/admin/tickets/{ticket['id']}/reply",
        json={"body": "I am support now."},
        headers=auth_headers,
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_an_empty_reply_is_rejected(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    ticket = await _file_ticket(client, auth_headers)
    res = await client.post(
        f"/api/v1/support/tickets/{ticket['id']}/messages",
        json={"body": "   "},
        headers=auth_headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_tickets_are_listed_by_latest_activity(
    client: AsyncClient, auth_headers: dict, admin_headers: dict
):
    """An old ticket answered this morning outranks one filed last week."""
    old = await _file_ticket(client, auth_headers, subject="Older")
    await _file_ticket(client, auth_headers, subject="Newer")

    res = await client.get("/api/v1/support/tickets/mine", headers=auth_headers)
    assert res.json()[0]["subject"] == "Newer"

    await client.post(
        f"/api/v1/admin/tickets/{old['id']}/reply",
        json={"body": "Sorry for the wait."},
        headers=admin_headers,
    )

    res = await client.get("/api/v1/support/tickets/mine", headers=auth_headers)
    assert res.json()[0]["subject"] == "Older"
