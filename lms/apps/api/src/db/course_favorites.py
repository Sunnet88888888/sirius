from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Index, Integer, UniqueConstraint
from sqlmodel import Field, SQLModel


class CourseFavorite(SQLModel, table=True):
    __tablename__ = "coursefavorite"
    __table_args__ = (
        UniqueConstraint("user_id", "course_id", name="unique_coursefavorite_user_course"),
        Index("ix_coursefavorite_user_id", "user_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    )
    course_id: int = Field(
        sa_column=Column(Integer, ForeignKey("course.id", ondelete="CASCADE"), nullable=False)
    )
    creation_date: str = ""


class CourseFavoritesRead(SQLModel):
    """Course uuids favourited by the current user, newest first."""

    course_uuids: List[str]
