"""swipe_allowances: server-side daily swipe bonus tracking

Revision ID: c3d5f7a9b201
Revises: a8f53e2b1701
Create Date: 2026-07-16 16:20:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d5f7a9b201'
down_revision: Union[str, None] = 'a8f53e2b1701'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'swipe_allowances',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('bonus_swipes', sa.Integer(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'day', name='uq_swipe_allowance_user_day'),
    )
    op.create_index(op.f('ix_swipe_allowances_user_id'), 'swipe_allowances', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_swipe_allowances_user_id'), table_name='swipe_allowances')
    op.drop_table('swipe_allowances')
