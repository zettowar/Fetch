"""parks: add source + external_id for external-dataset imports

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-04-18
"""
from alembic import op
import sqlalchemy as sa


revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # `source` is 'user' for existing user-submitted rows, 'osm' for imports,
    # 'seed' for initial demo data. Default 'user' keeps current rows intact.
    op.add_column(
        "parks",
        sa.Column(
            "source",
            sa.String(length=20),
            nullable=False,
            server_default="user",
        ),
    )
    # OSM element id (e.g., "way/12345", "node/67890"). Nullable because
    # user-submitted rows have none. Composite unique index lets us upsert
    # safely per source.
    op.add_column(
        "parks",
        sa.Column("external_id", sa.String(length=100), nullable=True),
    )
    op.create_index(
        "ix_parks_source_external_id",
        "parks",
        ["source", "external_id"],
        unique=True,
        postgresql_where=sa.text("external_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_parks_source_external_id", table_name="parks")
    op.drop_column("parks", "external_id")
    op.drop_column("parks", "source")
