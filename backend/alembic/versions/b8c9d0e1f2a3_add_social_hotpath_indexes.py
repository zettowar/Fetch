"""add social hot-path indexes

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-04-16
"""
from alembic import op


revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite for reaction-count aggregations grouped by (target_type, target_id).
    # The existing uq_reaction covers (user_id, target_type, target_id) — good for
    # user-reaction lookups, but counts by target benefit from a target-first index.
    op.create_index(
        "ix_reactions_target",
        "reactions",
        ["target_type", "target_id"],
    )

    # Same idea for comment lists.
    op.create_index(
        "ix_comments_target",
        "comments",
        ["target_type", "target_id"],
    )

    # Weekly winner and ranking queries GROUP BY week_bucket without filtering
    # on voter/dog — the existing single-column indexes don't help.
    op.create_index(
        "ix_votes_week_bucket",
        "votes",
        ["week_bucket"],
    )


def downgrade() -> None:
    op.drop_index("ix_votes_week_bucket", table_name="votes")
    op.drop_index("ix_comments_target", table_name="comments")
    op.drop_index("ix_reactions_target", table_name="reactions")
