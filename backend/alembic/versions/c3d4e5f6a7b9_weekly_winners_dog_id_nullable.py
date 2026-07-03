"""Make weekly_winners.dog_id nullable.

The model declares dog_id as nullable and f0a1b2c3d4e5 set the FK to
ON DELETE SET NULL, but the column was created NOT NULL in the initial
schema and never altered — so deleting a dog that ever won a week aborted
with a NOT NULL violation on migrated databases. (Invisible to tests,
which build their schema from the models via create_all.)

Revision ID: c3d4e5f6a7b9
Revises: b2c3d4e5f6a8
Create Date: 2026-07-02
"""

import sqlalchemy as sa
from alembic import op

revision = "c3d4e5f6a7b9"
down_revision = "b2c3d4e5f6a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "weekly_winners",
        "dog_id",
        existing_type=sa.UUID(),
        nullable=True,
    )


def downgrade() -> None:
    # Rows orphaned by ON DELETE SET NULL cannot satisfy NOT NULL; drop them
    # before restoring the constraint.
    op.execute("DELETE FROM weekly_winners WHERE dog_id IS NULL")
    op.alter_column(
        "weekly_winners",
        "dog_id",
        existing_type=sa.UUID(),
        nullable=False,
    )
