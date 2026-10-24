"""Add lesson comments, comment votes and notifications

Revision ID: a7b8c9d0e1f2
Revises: f1a2b3c4d5e6
Create Date: 2026-10-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The app also runs SQLModel create_all on startup, so tables may exist already.
    bind = op.get_bind()
    existing = set(sa.inspect(bind).get_table_names())

    if 'activitycomment' not in existing:
        op.create_table(
            'activitycomment',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('comment_uuid', sa.String(), nullable=False, server_default=''),
            sa.Column('activity_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('parent_id', sa.Integer(), nullable=True),
            sa.Column('content', sa.Text(), nullable=False),
            sa.Column('is_pinned', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('is_edited', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('upvote_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
            sa.Column('update_date', sa.String(), nullable=False, server_default=''),
            sa.ForeignKeyConstraint(['activity_id'], ['activity.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['parent_id'], ['activitycomment.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_activitycomment_comment_uuid', 'activitycomment', ['comment_uuid'])
        op.create_index('ix_activitycomment_activity_id', 'activitycomment', ['activity_id'])
        op.create_index('ix_activitycomment_parent_id', 'activitycomment', ['parent_id'])

    if 'activitycommentvote' not in existing:
        op.create_table(
            'activitycommentvote',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('comment_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
            sa.ForeignKeyConstraint(['comment_id'], ['activitycomment.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('comment_id', 'user_id', name='unique_activitycommentvote_comment_user'),
        )

    if 'notification' not in existing:
        op.create_table(
            'notification',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('notification_uuid', sa.String(), nullable=False, server_default=''),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('actor_id', sa.Integer(), nullable=True),
            sa.Column('type', sa.String(length=50), nullable=False),
            sa.Column('course_uuid', sa.String(), nullable=False, server_default=''),
            sa.Column('course_name', sa.String(), nullable=False, server_default=''),
            sa.Column('activity_uuid', sa.String(), nullable=False, server_default=''),
            sa.Column('activity_name', sa.String(), nullable=False, server_default=''),
            sa.Column('comment_uuid', sa.String(), nullable=False, server_default=''),
            sa.Column('snippet', sa.String(length=200), nullable=False, server_default=''),
            sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('creation_date', sa.String(), nullable=False, server_default=''),
            sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['actor_id'], ['user.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_notification_notification_uuid', 'notification', ['notification_uuid'])
        op.create_index('ix_notification_user_read', 'notification', ['user_id', 'is_read'])
        op.create_index('ix_notification_user_id_id', 'notification', ['user_id', 'id'])


def downgrade() -> None:
    op.drop_table('notification')
    op.drop_table('activitycommentvote')
    op.drop_table('activitycomment')
