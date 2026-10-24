from typing import List, Optional

from sqlalchemy import Boolean, Column, ForeignKey, Index, Integer, String
from sqlmodel import Field, SQLModel

from src.db.users import UserReadAuthor


class NotificationTypeEnum:
    COMMENT_REPLY = "comment_reply"      # someone answered your comment
    LESSON_COMMENT = "lesson_comment"    # someone commented under a lesson of your course


class Notification(SQLModel, table=True):
    __tablename__ = "notification"
    __table_args__ = (
        Index("ix_notification_user_read", "user_id", "is_read"),
        Index("ix_notification_user_id_id", "user_id", "id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    notification_uuid: str = Field(default="", index=True)
    # recipient
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    )
    actor_id: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL"), nullable=True),
    )
    type: str = Field(sa_column=Column(String(50), nullable=False))
    # Denormalised on purpose: the list renders without joins, and a notification
    # should still read sensibly after the lesson is renamed or removed.
    course_uuid: str = ""
    course_name: str = ""
    activity_uuid: str = ""
    activity_name: str = ""
    comment_uuid: str = ""
    snippet: str = Field(default="", sa_column=Column(String(200), nullable=False, default=""))
    is_read: bool = Field(default=False, sa_column=Column(Boolean, default=False, nullable=False))
    creation_date: str = ""


class NotificationRead(SQLModel):
    notification_uuid: str
    type: str
    actor: Optional[UserReadAuthor] = None
    course_uuid: str
    course_name: str
    activity_uuid: str
    activity_name: str
    comment_uuid: str
    snippet: str
    is_read: bool
    creation_date: str


class NotificationList(SQLModel):
    notifications: List[NotificationRead]
    unread_count: int


class UnreadCountRead(SQLModel):
    unread_count: int
