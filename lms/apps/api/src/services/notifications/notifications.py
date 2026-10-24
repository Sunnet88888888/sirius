from datetime import datetime, timezone
from typing import Iterable, List, Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, update
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.notifications import (
    Notification,
    NotificationList,
    NotificationRead,
    UnreadCountRead,
)
from src.db.users import AnonymousUser, PublicUser, User, UserReadAuthor


def _require_user(user: PublicUser | AnonymousUser) -> PublicUser:
    if isinstance(user, AnonymousUser):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user


def add_notifications(
    db_session: AsyncSession,
    recipient_ids: Iterable[int],
    *,
    actor_id: Optional[int],
    type: str,
    course_uuid: str,
    course_name: str,
    activity_uuid: str,
    activity_name: str,
    comment_uuid: str,
    snippet: str,
) -> None:
    """Queue one notification per recipient on the caller's transaction (no commit).
    The actor never notifies themselves."""
    now = str(datetime.now(timezone.utc))
    for recipient_id in {r for r in recipient_ids if r != actor_id}:
        db_session.add(
            Notification(
                notification_uuid=f"notification_{uuid4()}",
                user_id=recipient_id,
                actor_id=actor_id,
                type=type,
                course_uuid=course_uuid,
                course_name=course_name[:200],
                activity_uuid=activity_uuid,
                activity_name=activity_name[:200],
                comment_uuid=comment_uuid,
                snippet=snippet[:200],
                is_read=False,
                creation_date=now,
            )
        )


async def _unread_count(user_id: int, db_session: AsyncSession) -> int:
    return (
        await db_session.execute(
            select(func.count(Notification.id)).where(  # type: ignore
                Notification.user_id == user_id, Notification.is_read == False  # noqa: E712
            )
        )
    ).scalar_one()


async def list_notifications(
    user: PublicUser | AnonymousUser, db_session: AsyncSession, limit: int = 30
) -> NotificationList:
    user = _require_user(user)
    limit = max(1, min(limit, 100))
    rows = (
        await db_session.execute(
            select(Notification, User)
            .outerjoin(User, User.id == Notification.actor_id)  # type: ignore
            .where(Notification.user_id == user.id)
            .order_by(Notification.id.desc())  # type: ignore
            .limit(limit)
        )
    ).all()
    items: List[NotificationRead] = [
        NotificationRead(
            notification_uuid=n.notification_uuid,
            type=n.type,
            actor=UserReadAuthor.model_validate(actor) if actor else None,
            course_uuid=n.course_uuid,
            course_name=n.course_name,
            activity_uuid=n.activity_uuid,
            activity_name=n.activity_name,
            comment_uuid=n.comment_uuid,
            snippet=n.snippet,
            is_read=n.is_read,
            creation_date=n.creation_date,
        )
        for n, actor in rows
    ]
    return NotificationList(notifications=items, unread_count=await _unread_count(user.id, db_session))


async def get_unread_count(user: PublicUser | AnonymousUser, db_session: AsyncSession) -> UnreadCountRead:
    user = _require_user(user)
    return UnreadCountRead(unread_count=await _unread_count(user.id, db_session))


async def mark_read(notification_uuid: str, user: PublicUser | AnonymousUser, db_session: AsyncSession) -> None:
    user = _require_user(user)
    await db_session.execute(
        update(Notification)
        .where(Notification.notification_uuid == notification_uuid, Notification.user_id == user.id)  # type: ignore
        .values(is_read=True)
    )
    await db_session.commit()


async def mark_all_read(user: PublicUser | AnonymousUser, db_session: AsyncSession) -> None:
    user = _require_user(user)
    await db_session.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read == False)  # type: ignore  # noqa: E712
        .values(is_read=True)
    )
    await db_session.commit()
