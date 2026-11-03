"""Add legal consent columns to user

Version of the legal texts accepted at sign-up and the time. Idempotent: the app
creates tables with ``create_all``, which never adds a column to an existing table.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-11-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {c['name'] for c in sa.inspect(bind).get_columns('user')}
    if 'legal_consent_version' not in columns:
        op.add_column('user', sa.Column('legal_consent_version', sa.String(length=16), nullable=True))
    if 'legal_consent_at' not in columns:
        op.add_column('user', sa.Column('legal_consent_at', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('user', 'legal_consent_at')
    op.drop_column('user', 'legal_consent_version')
