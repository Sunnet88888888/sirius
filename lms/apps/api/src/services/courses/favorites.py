from datetime import datetime, timezone
from typing import List

from fastapi import HTTPException, Request, status
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlmodel import delete as sql_delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.course_favorites import CourseFavorite
from src.db.courses.courses import Course
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac import AccessAction, check_resource_access


def _require_user(user: PublicUser | AnonymousUser) -> PublicUser:
    if isinstance(user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user


async def _get_course(db_session: AsyncSession, course_uuid: str) -> Course:
    course = (
        await db_session.execute(select(Course).where(Course.course_uuid == course_uuid))
    ).scalars().first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


async def list_favorite_course_uuids(
    user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> List[str]:
    user = _require_user(user)
    rows = await db_session.execute(
        select(Course.course_uuid)  # type: ignore
        .join(CourseFavorite, CourseFavorite.course_id == Course.id)  # type: ignore
        .where(CourseFavorite.user_id == user.id)
        .order_by(CourseFavorite.id.desc())  # type: ignore
    )
    return list(rows.scalars().all())


async def add_favorite_course(
    request: Request,
    course_uuid: str,
    user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    user = _require_user(user)
    course = await _get_course(db_session, course_uuid)

    # Only courses the user is allowed to read can be favourited.
    await check_resource_access(
        request, db_session, user, course.course_uuid, AccessAction.READ
    )

    # Idempotent: a repeated click (or a second tab) must not fail on the unique key.
    await db_session.execute(
        pg_insert(CourseFavorite)
        .values(
            user_id=user.id,
            course_id=course.id,
            creation_date=str(datetime.now(timezone.utc)),
        )
        .on_conflict_do_nothing(constraint="unique_coursefavorite_user_course")
    )
    await db_session.commit()


async def remove_favorite_course(
    course_uuid: str,
    user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    user = _require_user(user)
    course = await _get_course(db_session, course_uuid)
    await db_session.execute(
        sql_delete(CourseFavorite).where(
            CourseFavorite.user_id == user.id,  # type: ignore
            CourseFavorite.course_id == course.id,  # type: ignore
        )
    )
    await db_session.commit()
