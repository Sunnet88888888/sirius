from typing import List, Optional

from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from src.db.users import UserReadAuthor

MAX_COMMENT_LENGTH = 2000


class ActivityComment(SQLModel, table=True):
    """A comment under a lesson. Replies are one level deep: ``parent_id`` always
    points at a top-level comment."""

    __tablename__ = "activitycomment"
    __table_args__ = (
        Index("ix_activitycomment_activity_id", "activity_id"),
        Index("ix_activitycomment_parent_id", "parent_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    comment_uuid: str = Field(default="", index=True)
    activity_id: int = Field(
        sa_column=Column(Integer, ForeignKey("activity.id", ondelete="CASCADE"), nullable=False)
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    )
    parent_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("activitycomment.id", ondelete="CASCADE"), nullable=True),
    )
    content: str = Field(sa_column=Column(Text, nullable=False))
    is_pinned: bool = Field(default=False, sa_column=Column(Boolean, default=False, nullable=False))
    is_edited: bool = Field(default=False, sa_column=Column(Boolean, default=False, nullable=False))
    upvote_count: int = 0
    creation_date: str = ""
    update_date: str = ""


class ActivityCommentVote(SQLModel, table=True):
    __tablename__ = "activitycommentvote"
    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="unique_activitycommentvote_comment_user"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    comment_id: int = Field(
        sa_column=Column(Integer, ForeignKey("activitycomment.id", ondelete="CASCADE"), nullable=False)
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    )
    creation_date: str = ""


class ActivityCommentCreate(SQLModel):
    content: str
    # Comment being answered. Answering a reply attaches to its thread.
    parent_uuid: Optional[str] = None


class ActivityCommentUpdate(SQLModel):
    content: str


class ActivityCommentRead(SQLModel):
    comment_uuid: str
    parent_uuid: Optional[str] = None
    content: str
    is_pinned: bool
    is_edited: bool
    upvote_count: int
    has_voted: bool
    can_edit: bool
    can_delete: bool
    author: UserReadAuthor
    creation_date: str
    update_date: str


class ActivityCommentList(SQLModel):
    comments: List[ActivityCommentRead]
    # May the caller post? (signed in and enrolled, or a course editor)
    can_comment: bool
    # Course editors can delete anyone's comment and pin top-level ones.
    can_moderate: bool


class ActivityCommentVoteRead(SQLModel):
    upvote_count: int
    has_voted: bool
