"""In-app donations (Stripe) + rescue Connect columns.

- donations: one row per Stripe Checkout donation (platform- or rescue-bound);
  donor/rescue FKs SET NULL so financial records outlive account deletion.
- stripe_events: processed webhook event ids (replay/idempotency ledger).
- rescue_profiles.stripe_account_id / stripe_charges_enabled: Stripe Connect
  Express state for rescues accepting in-app donations.

Revision ID: b1c2d3e4f5a6
Revises: 0a1b2c3d4e5f
Create Date: 2026-07-05
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "b1c2d3e4f5a6"
down_revision = "0a1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "donations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recipient_type", sa.String(length=20), nullable=False),
        sa.Column("rescue_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("recipient_name", sa.String(length=200), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("application_fee_cents", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("stripe_checkout_session_id", sa.String(length=255), nullable=False),
        sa.Column("stripe_payment_intent_id", sa.String(length=255), nullable=True),
        sa.Column("message", sa.String(length=280), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["rescue_id"], ["rescue_profiles.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("stripe_checkout_session_id"),
    )
    op.create_index("ix_donations_user_id", "donations", ["user_id"])
    op.create_index("ix_donations_rescue_id", "donations", ["rescue_id"])
    op.create_index("ix_donations_status", "donations", ["status"])
    op.create_index(
        "ix_donations_stripe_payment_intent_id",
        "donations",
        ["stripe_payment_intent_id"],
    )

    op.create_table(
        "stripe_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("event_id", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=60), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("event_id"),
    )

    op.add_column(
        "rescue_profiles",
        sa.Column("stripe_account_id", sa.String(length=64), nullable=True),
    )
    op.create_unique_constraint(
        "uq_rescue_profiles_stripe_account_id",
        "rescue_profiles",
        ["stripe_account_id"],
    )
    op.add_column(
        "rescue_profiles",
        sa.Column(
            "stripe_charges_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("rescue_profiles", "stripe_charges_enabled")
    op.drop_constraint(
        "uq_rescue_profiles_stripe_account_id", "rescue_profiles", type_="unique"
    )
    op.drop_column("rescue_profiles", "stripe_account_id")
    op.drop_table("stripe_events")
    op.drop_index("ix_donations_stripe_payment_intent_id", table_name="donations")
    op.drop_index("ix_donations_status", table_name="donations")
    op.drop_index("ix_donations_rescue_id", table_name="donations")
    op.drop_index("ix_donations_user_id", table_name="donations")
    op.drop_table("donations")
