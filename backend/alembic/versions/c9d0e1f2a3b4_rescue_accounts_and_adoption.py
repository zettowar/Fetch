"""rescue accounts, adoption flow, and user prompt preference

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- Drop the legacy community-submitted rescues table (seed data only). ---
    # Indexes/FKs auto-drop with the table.
    op.drop_table("rescues")

    # --- rescue_profiles: one row per rescue user, admin-gated. ---
    op.create_table(
        "rescue_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("org_name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("donation_url", sa.String(length=500), nullable=True),
        sa.Column("proof_details", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column(
            "reviewed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_rescue_profiles_status", "rescue_profiles", ["status"])

    # --- Adoption columns on dogs ---
    op.add_column(
        "dogs",
        sa.Column("adopted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "dogs",
        sa.Column(
            "adopted_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # --- User-level adoption-prompt preference ---
    op.add_column(
        "users",
        sa.Column(
            "show_adoption_prompt",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )

    # --- dog_transfers: rescue → fetch-user handoffs ---
    op.create_table(
        "dog_transfers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "dog_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("dogs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "from_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "to_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("invited_email", sa.String(length=320), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_dog_transfers_dog_id", "dog_transfers", ["dog_id"])
    op.create_index("ix_dog_transfers_to_user_id", "dog_transfers", ["to_user_id"])
    op.create_index("ix_dog_transfers_status", "dog_transfers", ["status"])


def downgrade() -> None:
    op.drop_index("ix_dog_transfers_status", table_name="dog_transfers")
    op.drop_index("ix_dog_transfers_to_user_id", table_name="dog_transfers")
    op.drop_index("ix_dog_transfers_dog_id", table_name="dog_transfers")
    op.drop_table("dog_transfers")

    op.drop_column("users", "show_adoption_prompt")
    op.drop_column("dogs", "adopted_by_user_id")
    op.drop_column("dogs", "adopted_at")

    op.drop_index("ix_rescue_profiles_status", table_name="rescue_profiles")
    op.drop_table("rescue_profiles")

    # Recreate legacy rescues table (minimal — legacy seed data is lost).
    op.create_table(
        "rescues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("donation_url", sa.String(length=500), nullable=True),
        sa.Column("logo_key", sa.Text(), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("featured_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "submitted_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
