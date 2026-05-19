"""add lat lng to rescue profiles

Revision ID: 08f8c2dabcde
Revises: f7a8b9c0d1e2
Create Date: 2026-05-18 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '08f8c2dabcde'
down_revision: Union[str, None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('rescue_profiles', sa.Column('lat', sa.Float(), nullable=True))
    op.add_column('rescue_profiles', sa.Column('lng', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('rescue_profiles', 'lng')
    op.drop_column('rescue_profiles', 'lat')
