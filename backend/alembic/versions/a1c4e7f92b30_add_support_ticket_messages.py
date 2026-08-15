"""add support ticket messages

Gives support tickets a reply channel. Until now a ticket was write-only from
the reporter's side: they sent a message, staff could set a status and leave an
internal note, and nothing ever reached the person who asked.

The opening body stays on `support_tickets.body` — this table holds replies
only, so there is no backfill and no second copy of the same paragraph.

`awaiting_staff` defaults TRUE for existing rows on purpose: every ticket
already in the table predates the reply channel, so by definition none of them
has been answered.

Revision ID: a1c4e7f92b30
Revises: d800ade9fcff
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a1c4e7f92b30"
down_revision = "d800ade9fcff"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "support_ticket_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("author_role", sa.String(length=10), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["ticket_id"], ["support_tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_support_ticket_messages_ticket_id", "support_ticket_messages", ["ticket_id"]
    )

    op.add_column(
        "support_tickets", sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "support_tickets",
        sa.Column("awaiting_staff", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "support_tickets",
        sa.Column("reporter_last_read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_support_tickets_awaiting_staff", "support_tickets", ["awaiting_staff"])

    # Seed the sort key from the ticket's own creation so the queue orders
    # sensibly on day one rather than putting every pre-existing ticket last.
    op.execute("UPDATE support_tickets SET last_message_at = created_at")
    # A ticket somebody already finished with is not waiting on support.
    op.execute(
        "UPDATE support_tickets SET awaiting_staff = false "
        "WHERE status IN ('resolved', 'closed')"
    )


def downgrade() -> None:
    op.drop_index("ix_support_tickets_awaiting_staff", table_name="support_tickets")
    op.drop_column("support_tickets", "reporter_last_read_at")
    op.drop_column("support_tickets", "awaiting_staff")
    op.drop_column("support_tickets", "last_message_at")
    op.drop_index("ix_support_ticket_messages_ticket_id", table_name="support_ticket_messages")
    op.drop_table("support_ticket_messages")
