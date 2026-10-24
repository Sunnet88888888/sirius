"""Add aicodereview table

One row per delivered AI review of a student's code; also the usage ledger for
the per-student daily/monthly review limits.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-10-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The app also runs SQLModel create_all on startup, so the table may exist already.
    if sa.inspect(op.get_bind()).has_table('aicodereview'):
        return
    op.create_table(
        'aicodereview',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('review_uuid', sa.String(), nullable=False, server_default=''),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('assignment_task_id', sa.Integer(), nullable=False),
        sa.Column('language_id', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('source_code', sa.Text(), nullable=False),
        sa.Column('tests_passed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tests_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('review', sa.JSON(), nullable=True),
        sa.Column('model_name', sa.String(), nullable=False, server_default=''),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assignment_task_id'], ['assignmenttask.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_aicodereview_review_uuid', 'aicodereview', ['review_uuid'])
    op.create_index('ix_aicodereview_user_created', 'aicodereview', ['user_id', 'creation_date'])
    op.create_index('ix_aicodereview_task_user', 'aicodereview', ['assignment_task_id', 'user_id'])


def downgrade() -> None:
    op.drop_table('aicodereview')
