"""add vets table

Revision ID: 19a83f7c2bde
Revises: 08f8c2dabcde
Create Date: 2026-05-19 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '19a83f7c2bde'
down_revision: Union[str, None] = '08f8c2dabcde'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'vets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('website', sa.String(length=500), nullable=True),
        sa.Column('hours', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('verified', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('attributes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False, server_default='user'),
        sa.Column('external_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_vets_lat', 'vets', ['lat'], unique=False)
    op.create_index('ix_vets_lng', 'vets', ['lng'], unique=False)
    op.create_index('ix_vets_source_external_id', 'vets', ['source', 'external_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_vets_source_external_id', table_name='vets')
    op.drop_index('ix_vets_lng', table_name='vets')
    op.drop_index('ix_vets_lat', table_name='vets')
    op.drop_table('vets')
