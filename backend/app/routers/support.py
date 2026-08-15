import uuid as uuid_mod
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_staff
from app.limiter import limiter
from app.models.support import FAQEntry, SupportTicket, SupportTicketMessage
from app.models.user import User
from app.schemas.support import (
    FAQOut,
    TicketCreate,
    TicketMessageCreate,
    TicketMessageOut,
    TicketMineOut,
    TicketOut,
    TicketThreadOut,
)

router = APIRouter()

# A closed ticket is the one terminal state. "resolved" is not terminal — a
# reporter who says "that didn't work" must be able to reopen rather than file a
# second ticket that nobody can connect to the first.
_TERMINAL_STATUS = "closed"


def _generate_ticket_number() -> str:
    return f"FETCH-{uuid_mod.uuid4().hex[:8].upper()}"


async def _thread_counts(
    db: AsyncSession, ticket_ids: list[UUID]
) -> dict[UUID, tuple[int, int]]:
    """``{ticket_id: (reply_count, unread_staff_replies)}`` in a single query.

    The unread comparison joins back to the ticket for its own watermark, so
    both numbers come out of one grouped aggregate. Counting them per ticket
    instead would put a query-per-row behind a list endpoint — the classic way
    a support page gets slower the longer someone has been a customer.

    A null watermark means the reporter has never opened the thread, so every
    staff reply in it is unread.
    """
    if not ticket_ids:
        return {}
    unread_case = case(
        (
            (SupportTicketMessage.author_role == "staff")
            & (
                (SupportTicket.reporter_last_read_at.is_(None))
                | (SupportTicketMessage.created_at > SupportTicket.reporter_last_read_at)
            ),
            1,
        ),
        else_=None,
    )
    rows = await db.execute(
        select(
            SupportTicketMessage.ticket_id,
            func.count().label("total"),
            func.count(unread_case).label("unread"),
        )
        .join(SupportTicket, SupportTicket.id == SupportTicketMessage.ticket_id)
        .where(SupportTicketMessage.ticket_id.in_(ticket_ids))
        .group_by(SupportTicketMessage.ticket_id)
    )
    counted = {r.ticket_id: (r.total, r.unread) for r in rows}
    return {tid: counted.get(tid, (0, 0)) for tid in ticket_ids}


@router.get("/faq", response_model=list[FAQOut])
async def list_faq(
    category: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(FAQEntry).order_by(FAQEntry.sort_order, FAQEntry.created_at)
    if category:
        query = query.where(FAQEntry.category == category)
    result = await db.execute(query.limit(100))
    return list(result.scalars().all())


@router.post("/tickets", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
async def create_ticket(
    request: Request,
    body_data: TicketCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = SupportTicket(
        user_id=user.id,
        subject=body_data.subject,
        body=body_data.body,
        source_screen=body_data.source_screen,
        ticket_number=_generate_ticket_number(),
        last_message_at=datetime.now(timezone.utc),
        awaiting_staff=True,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket


@router.get("/tickets/mine", response_model=list[TicketMineOut])
async def my_tickets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.user_id == user.id)
        .order_by(
            # Activity order, not filing order: a two-month-old ticket that was
            # answered this morning is the one they came here to read.
            func.coalesce(SupportTicket.last_message_at, SupportTicket.created_at).desc()
        )
        .limit(50)
    )
    tickets = list(result.scalars().all())
    counts = await _thread_counts(db, [t.id for t in tickets])
    out = []
    for t in tickets:
        reply_count, unread = counts.get(t.id, (0, 0))
        item = TicketMineOut.model_validate(t)
        item.reply_count = reply_count
        item.unread_count = unread
        out.append(item)
    return out


@router.get("/tickets/unread-count")
async def my_unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Total unread staff replies across the caller's tickets.

    Separate from /tickets/mine so the shell can badge the support entry without
    fetching every ticket body on every page load.
    """
    result = await db.execute(
        select(SupportTicket.id).where(SupportTicket.user_id == user.id)
    )
    counts = await _thread_counts(db, [r[0] for r in result.all()])
    return {"unread": sum(unread for _, unread in counts.values())}


@router.get("/tickets/{ticket_id}", response_model=TicketThreadOut)
async def my_ticket_thread(
    ticket_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The full conversation on one of the caller's own tickets.

    Reading it clears the unread watermark — the reporter has, definitionally,
    just read everything in it.
    """
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id, SupportTicket.user_id == user.id
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        # Same 404 a missing ticket gives — never confirm someone else's exists.
        raise HTTPException(status_code=404, detail="Ticket not found")

    messages = list(
        (
            await db.execute(
                select(SupportTicketMessage)
                .where(SupportTicketMessage.ticket_id == ticket.id)
                .order_by(SupportTicketMessage.created_at)
            )
        )
        .scalars()
        .all()
    )

    out = TicketThreadOut.model_validate(ticket)
    out.messages = [TicketMessageOut.model_validate(m) for m in messages]
    out.reply_count = len(messages)
    out.unread_count = 0

    ticket.reporter_last_read_at = datetime.now(timezone.utc)
    await db.commit()
    return out


@router.post(
    "/tickets/{ticket_id}/messages",
    response_model=TicketMessageOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("30/hour")
async def reply_to_my_ticket(
    ticket_id: UUID,
    request: Request,
    body_data: TicketMessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id, SupportTicket.user_id == user.id
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == _TERMINAL_STATUS:
        raise HTTPException(
            status_code=409,
            detail="This ticket is closed — please start a new one.",
        )

    message = SupportTicketMessage(
        ticket_id=ticket.id,
        author_id=user.id,
        author_role="user",
        body=body_data.body,
    )
    db.add(message)

    now = datetime.now(timezone.utc)
    ticket.last_message_at = now
    ticket.awaiting_staff = True
    # Their own message is not something they need to be told about.
    ticket.reporter_last_read_at = now
    # A reply to a resolved ticket means it was not, in fact, resolved. Reopening
    # is what keeps "resolved" honest as a queue state instead of a place tickets
    # go to be forgotten while the person is still stuck.
    if ticket.status == "resolved":
        ticket.status = "open"

    await db.commit()
    await db.refresh(message)
    return message


@router.get("/tickets", response_model=list[TicketOut])
async def list_all_tickets(
    response: Response,
    status_filter: str = Query("open"),
    q: str = Query(default=""),
    awaiting: bool = Query(default=False),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    staff: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Staff ticket queue: status filter + free-text search over subject,
    body, and ticket number, paginated (was previously hard-capped at 100)."""
    filters = []
    if status_filter != "all":
        filters.append(SupportTicket.status == status_filter)
    if awaiting:
        filters.append(SupportTicket.awaiting_staff.is_(True))
    if q:
        filters.append(or_(
            SupportTicket.subject.ilike(f"%{q}%"),
            SupportTicket.body.ilike(f"%{q}%"),
            SupportTicket.ticket_number.ilike(f"%{q}%"),
        ))

    count_stmt = select(func.count()).select_from(SupportTicket)
    for f in filters:
        count_stmt = count_stmt.where(f)
    total = (await db.execute(count_stmt)).scalar() or 0
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"

    query = select(SupportTicket).order_by(
        func.coalesce(SupportTicket.last_message_at, SupportTicket.created_at).desc()
    )
    for f in filters:
        query = query.where(f)
    result = await db.execute(query.offset(offset).limit(limit))
    tickets = list(result.scalars().all())

    reply_counts = {}
    if tickets:
        rows = await db.execute(
            select(SupportTicketMessage.ticket_id, func.count())
            .where(SupportTicketMessage.ticket_id.in_([t.id for t in tickets]))
            .group_by(SupportTicketMessage.ticket_id)
        )
        reply_counts = {r[0]: r[1] for r in rows}

    out = []
    for t in tickets:
        item = TicketOut.model_validate(t)
        item.reply_count = reply_counts.get(t.id, 0)
        out.append(item)
    return out
