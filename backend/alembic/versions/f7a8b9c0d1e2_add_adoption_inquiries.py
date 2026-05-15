"""adoption_inquiries table

Revision ID: f7a8b9c0d1e2
Revises: e1a2b3c4d5f6
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f7a8b9c0d1e2"
down_revision = "e1a2b3c4d5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "adoption_inquiries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "rescue_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("rescue_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "dog_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("dogs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "inquirer_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_adoption_inquiries_rescue_id", "adoption_inquiries", ["rescue_id"])
    op.create_index("ix_adoption_inquiries_dog_id", "adoption_inquiries", ["dog_id"])
    op.create_index("ix_adoption_inquiries_inquirer_id", "adoption_inquiries", ["inquirer_id"])


def downgrade() -> None:
    op.drop_index("ix_adoption_inquiries_inquirer_id", table_name="adoption_inquiries")
    op.drop_index("ix_adoption_inquiries_dog_id", table_name="adoption_inquiries")
    op.drop_index("ix_adoption_inquiries_rescue_id", table_name="adoption_inquiries")
    op.drop_table("adoption_inquiries")
