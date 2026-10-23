"""Add coursefavorite table

Per-user favourite courses. One row per (user, course); rows disappear with
either the user or the course.

Revision ID: f1a2b3c4d5e6
Revises: b6e199d023f8
Create Date: 2026-10-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'b6e199d023f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The app also runs SQLModel create_all on startup, so the table may exist already.
    bind = op.get_bind()
    if sa.inspect(bind).has_table('coursefavorite'):
        return
    op.create_table(
        'coursefavorite',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['course_id'], ['course.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'course_id', name='unique_coursefavorite_user_course'),
    )
    op.create_index('ix_coursefavorite_user_id', 'coursefavorite', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_coursefavorite_user_id', table_name='coursefavorite')
    op.drop_table('coursefavorite')
