"""add sighting photo fields

Revision ID: e1a2b3c4d5f6
Revises: d0e1f2a3b4c5
Create Date: 2026-04-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1a2b3c4d5f6"
down_revision: Union[str, None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("lost_report_sightings", "photo_id")
    op.add_column(
        "lost_report_sightings",
        sa.Column("photo_key", sa.Text(), nullable=True),
    )
    op.add_column(
        "lost_report_sightings",
        sa.Column("photo_content_type", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("lost_report_sightings", "photo_content_type")
    op.drop_column("lost_report_sightings", "photo_key")
    op.add_column(
        "lost_report_sightings",
        sa.Column("photo_id", sa.UUID(), nullable=True),
    )
