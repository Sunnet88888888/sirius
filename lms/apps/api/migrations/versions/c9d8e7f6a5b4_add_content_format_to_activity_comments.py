"""Add content_format to lesson comments

'text' (default, all existing comments) or 'tiptap' (formatted comment stored as
a validated Tiptap JSON document). Idempotent: the app creates tables with
``create_all``, which never adds a column to an existing table.

Revision ID: c9d8e7f6a5b4
Revises: b6e199d023f8
Create Date: 2026-11-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d8e7f6a5b4'
down_revision: Union[str, None] = 'b6e199d023f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {c['name'] for c in sa.inspect(bind).get_columns('activitycomment')}
    if 'content_format' not in columns:
        op.add_column(
            'activitycomment',
            sa.Column('content_format', sa.String(length=16), nullable=False, server_default='text'),
        )


def downgrade() -> None:
    op.drop_column('activitycomment', 'content_format')
