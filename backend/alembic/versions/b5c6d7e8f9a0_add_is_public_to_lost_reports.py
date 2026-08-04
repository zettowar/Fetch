"""add is_public to lost_reports

Adds an opt-in public-share flag to lost reports. Server default is False so
existing rows are not retroactively exposed off-platform; new reports opt in
via the create schema / UI toggle (Python-side default True).

Revision ID: b5c6d7e8f9a0
Revises: b4596faa50f9
Create Date: 2026-07-19

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "b5c6d7e8f9a0"
down_revision = "b4596faa50f9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "lost_reports",
        sa.Column(
            "is_public",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("lost_reports", "is_public")
