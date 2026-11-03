"""Add language to course

Short language code ('ru', 'en'); NULL means "any language" and is shown to every
visitor. Idempotent: the app creates tables with ``create_all``, which never adds
a column to an existing table.

Revision ID: d1e2f3a4b5c6
Revises: c9d8e7f6a5b4
Create Date: 2026-11-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c9d8e7f6a5b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {c['name'] for c in sa.inspect(bind).get_columns('course')}
    if 'language' not in columns:
        op.add_column('course', sa.Column('language', sa.String(length=10), nullable=True))
    indexes = {i['name'] for i in sa.inspect(bind).get_indexes('course')}
    if 'ix_course_language' not in indexes:
        op.create_index('ix_course_language', 'course', ['language'])


def downgrade() -> None:
    op.drop_index('ix_course_language', table_name='course')
    op.drop_column('course', 'language')
