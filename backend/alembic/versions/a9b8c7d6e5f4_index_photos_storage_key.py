"""Unique index on photos.storage_key.

The moderation-gated public file endpoint looks Photo up by storage_key on
every image request; without an index that's a sequential scan on a hot path.
Keys are server-generated UUIDs, so uniqueness holds by construction.

Revision ID: a9b8c7d6e5f4
Revises: c3d4e5f6a7b9
Create Date: 2026-07-02
"""

from alembic import op

revision = "a9b8c7d6e5f4"
down_revision = "c3d4e5f6a7b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_photos_storage_key", "photos", ["storage_key"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_photos_storage_key", table_name="photos")
