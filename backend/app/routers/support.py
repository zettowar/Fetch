import uuid as uuid_mod

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import get_current_user, require_admin
from app.limiter import limiter
from app.models.support import FAQEntry, SupportTicket
from app.models.user import User
from app.schemas.support import FAQOut, TicketCreate, TicketOut

router = APIRouter()


def _generate_ticket_number() -> str:
    return f"FETCH-{uuid_mod.uuid4().hex[:8].upper()}"


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
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return ticket


@router.get("/tickets/mine", response_model=list[TicketOut])
async def my_tickets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.created_at.desc())
        .limit(50)
    )
    return list(result.scalars().all())


@router.get("/tickets", response_model=list[TicketOut])
async def list_all_tickets(
    status_filter: str = Query("open"),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(SupportTicket).order_by(SupportTicket.created_at.desc()).limit(100)
    if status_filter != "all":
        query = query.where(SupportTicket.status == status_filter)
    result = await db.execute(query)
    return list(result.scalars().all())
