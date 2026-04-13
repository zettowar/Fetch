"""add post search gin index and trigger

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Branch Labels: None
Depends On: None
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # GIN index for fast full-text search on posts
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_posts_search "
        "ON posts USING gin(search_vector)"
    )

    # Trigger to keep search_vector updated automatically on insert/update
    op.execute("""
        CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(NEW.body, '')), 'B');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("DROP TRIGGER IF EXISTS tsvectorupdate ON posts")
    op.execute("""
        CREATE TRIGGER tsvectorupdate
        BEFORE INSERT OR UPDATE ON posts
        FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update()
    """)

    # Backfill existing rows
    op.execute("""
        UPDATE posts SET search_vector =
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(body, '')), 'B');
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS tsvectorupdate ON posts")
    op.execute("DROP FUNCTION IF EXISTS posts_search_vector_update()")
    op.execute("DROP INDEX IF EXISTS idx_posts_search")
