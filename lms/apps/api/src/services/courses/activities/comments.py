from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import HTTPException, Request, status
from sqlalchemy import delete as sql_delete, func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.activity_comments import (
    MAX_COMMENT_LENGTH,
    ActivityComment,
    ActivityCommentCreate,
    ActivityCommentList,
    ActivityCommentRead,
    ActivityCommentUpdate,
    ActivityCommentVote,
    ActivityCommentVoteRead,
)
from src.db.courses.activities import Activity
from src.db.courses.courses import Course
from src.db.notifications import NotificationTypeEnum
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipStatusEnum
from src.db.trail_runs import TrailRun
from src.db.users import AnonymousUser, PublicUser, User, UserReadAuthor
from src.services.courses.activities.access import (
    can_edit_course,
    verify_activity_reader_access_by_uuid,
)
from src.services.notifications.notifications import add_notifications


def _require_user(user: PublicUser | AnonymousUser) -> PublicUser:
    if isinstance(user, AnonymousUser):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return user


def _clean_content(raw: str) -> str:
    content = (raw or "").strip()
    if not content:
        raise HTTPException(status_code=422, detail="Comment cannot be empty")
    if len(content) > MAX_COMMENT_LENGTH:
        raise HTTPException(status_code=422, detail=f"Comment is longer than {MAX_COMMENT_LENGTH} characters")
    return content


async def _is_enrolled(user_id: int, course_id: int, db_session: AsyncSession) -> bool:
    return (
        await db_session.execute(
            select(TrailRun.id).where(TrailRun.user_id == user_id, TrailRun.course_id == course_id).limit(1)  # type: ignore
        )
    ).first() is not None


async def _load_comment(
    comment_uuid: str, db_session: AsyncSession
) -> tuple[ActivityComment, Activity, Course]:
    row = (
        await db_session.execute(
            select(ActivityComment, Activity, Course)
            .join(Activity, Activity.id == ActivityComment.activity_id)  # type: ignore
            .join(Course, Course.id == Activity.course_id)  # type: ignore
            .where(ActivityComment.comment_uuid == comment_uuid)
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Comment not found")
    return row[0], row[1], row[2]


async def list_activity_comments(
    request: Request,
    activity_uuid: str,
    user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ActivityCommentList:
    activity, course = await verify_activity_reader_access_by_uuid(request, activity_uuid, user, db_session)
    anonymous = isinstance(user, AnonymousUser)
    moderator = False if anonymous else await can_edit_course(request, course.course_uuid, user, db_session)
    can_comment = moderator or (not anonymous and await _is_enrolled(user.id, course.id, db_session))

    rows = (
        await db_session.execute(
            select(ActivityComment, User)
            .join(User, User.id == ActivityComment.user_id)  # type: ignore
            .where(ActivityComment.activity_id == activity.id)
            .order_by(ActivityComment.id.asc())  # type: ignore
            .limit(500)
        )
    ).all()

    voted: set[int] = set()
    if not anonymous and rows:
        voted = set(
            (
                await db_session.execute(
                    select(ActivityCommentVote.comment_id).where(
                        ActivityCommentVote.user_id == user.id,
                        ActivityCommentVote.comment_id.in_([c.id for c, _ in rows]),  # type: ignore
                    )
                )
            ).scalars().all()
        )

    uuid_by_id: Dict[int, str] = {c.id: c.comment_uuid for c, _ in rows}  # type: ignore
    comments: List[ActivityCommentRead] = []
    for comment, author in rows:
        own = not anonymous and comment.user_id == user.id
        comments.append(
            ActivityCommentRead(
                comment_uuid=comment.comment_uuid,
                parent_uuid=uuid_by_id.get(comment.parent_id) if comment.parent_id else None,
                content=comment.content,
                is_pinned=comment.is_pinned,
                is_edited=comment.is_edited,
                upvote_count=comment.upvote_count,
                has_voted=comment.id in voted,
                can_edit=own,
                can_delete=own or moderator,
                author=UserReadAuthor.model_validate(author),
                creation_date=comment.creation_date,
                update_date=comment.update_date,
            )
        )
    return ActivityCommentList(comments=comments, can_comment=can_comment, can_moderate=moderator)


async def create_activity_comment(
    request: Request,
    activity_uuid: str,
    data: ActivityCommentCreate,
    user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ActivityCommentRead:
    user = _require_user(user)
    activity, course = await verify_activity_reader_access_by_uuid(request, activity_uuid, user, db_session)
    moderator = await can_edit_course(request, course.course_uuid, user, db_session)
    if not moderator and not await _is_enrolled(user.id, course.id, db_session):
        raise HTTPException(status_code=403, detail="Start the course to join the discussion")
    content = _clean_content(data.content)

    replied: Optional[ActivityComment] = None
    root_id: Optional[int] = None
    if data.parent_uuid:
        replied = (
            await db_session.execute(
                select(ActivityComment).where(
                    ActivityComment.comment_uuid == data.parent_uuid,
                    ActivityComment.activity_id == activity.id,
                )
            )
        ).scalars().first()
        if not replied:
            raise HTTPException(status_code=404, detail="Comment to reply to not found")
        # one level deep: answering a reply joins the thread of its top-level comment
        root_id = replied.parent_id or replied.id

    now = str(datetime.now(timezone.utc))
    comment = ActivityComment(
        comment_uuid=f"activitycomment_{uuid4()}",
        activity_id=activity.id,
        user_id=user.id,
        parent_id=root_id,
        content=content,
        creation_date=now,
        update_date=now,
    )
    db_session.add(comment)
    await db_session.flush()

    notify = dict(
        actor_id=user.id,
        course_uuid=course.course_uuid,
        course_name=course.name,
        activity_uuid=activity.activity_uuid,
        activity_name=activity.name,
        comment_uuid=comment.comment_uuid,
        snippet=content,
    )
    if replied is not None:
        add_notifications(db_session, [replied.user_id], type=NotificationTypeEnum.COMMENT_REPLY, **notify)
    else:
        author_ids = (
            await db_session.execute(
                select(ResourceAuthor.user_id).where(
                    ResourceAuthor.resource_uuid == course.course_uuid,
                    ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
                )
            )
        ).scalars().all()
        add_notifications(db_session, author_ids, type=NotificationTypeEnum.LESSON_COMMENT, **notify)
    await db_session.commit()

    root_uuid: Optional[str] = None
    if root_id is not None:
        root_uuid = replied.comment_uuid if replied.parent_id is None else await _uuid_of(root_id, db_session)  # type: ignore[union-attr]
    author = (await db_session.execute(select(User).where(User.id == user.id))).scalars().one()
    return ActivityCommentRead(
        comment_uuid=comment.comment_uuid,
        parent_uuid=root_uuid,
        content=comment.content,
        is_pinned=False,
        is_edited=False,
        upvote_count=0,
        has_voted=False,
        can_edit=True,
        can_delete=True,
        author=UserReadAuthor.model_validate(author),
        creation_date=comment.creation_date,
        update_date=comment.update_date,
    )


async def _uuid_of(comment_id: int, db_session: AsyncSession) -> str:
    return (
        await db_session.execute(select(ActivityComment.comment_uuid).where(ActivityComment.id == comment_id))
    ).scalar_one()


async def update_activity_comment(
    request: Request,
    comment_uuid: str,
    data: ActivityCommentUpdate,
    user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    user = _require_user(user)
    comment, activity, course = await _load_comment(comment_uuid, db_session)
    await verify_activity_reader_access_by_uuid(request, activity.activity_uuid, user, db_session)
    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")
    content = _clean_content(data.content)
    if content != comment.content:
        comment.content = content
        comment.is_edited = True
        comment.update_date = str(datetime.now(timezone.utc))
        db_session.add(comment)
        await db_session.commit()


async def delete_activity_comment(
    request: Request,
    comment_uuid: str,
    user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    user = _require_user(user)
    comment, activity, course = await _load_comment(comment_uuid, db_session)
    if comment.user_id != user.id and not await can_edit_course(request, course.course_uuid, user, db_session):
        raise HTTPException(status_code=403, detail="Not allowed to delete this comment")
    # replies and votes go with it (FK cascade)
    await db_session.execute(sql_delete(ActivityComment).where(ActivityComment.id == comment.id))  # type: ignore
    await db_session.commit()


async def toggle_comment_vote(
    request: Request,
    comment_uuid: str,
    user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> ActivityCommentVoteRead:
    user = _require_user(user)
    comment, activity, course = await _load_comment(comment_uuid, db_session)
    await verify_activity_reader_access_by_uuid(request, activity.activity_uuid, user, db_session)

    existing = (
        await db_session.execute(
            select(ActivityCommentVote).where(
                ActivityCommentVote.comment_id == comment.id, ActivityCommentVote.user_id == user.id
            )
        )
    ).scalars().first()
    if existing:
        await db_session.execute(sql_delete(ActivityCommentVote).where(ActivityCommentVote.id == existing.id))  # type: ignore
        has_voted = False
    else:
        db_session.add(
            ActivityCommentVote(comment_id=comment.id, user_id=user.id, creation_date=str(datetime.now(timezone.utc)))
        )
        has_voted = True
    await db_session.flush()
    comment.upvote_count = (
        await db_session.execute(
            select(func.count(ActivityCommentVote.id)).where(ActivityCommentVote.comment_id == comment.id)  # type: ignore
        )
    ).scalar_one()
    db_session.add(comment)
    await db_session.commit()
    return ActivityCommentVoteRead(upvote_count=comment.upvote_count, has_voted=has_voted)


async def toggle_comment_pin(
    request: Request,
    comment_uuid: str,
    user: PublicUser | AnonymousUser,
    db_session: AsyncSession,
) -> None:
    user = _require_user(user)
    comment, activity, course = await _load_comment(comment_uuid, db_session)
    if not await can_edit_course(request, course.course_uuid, user, db_session):
        raise HTTPException(status_code=403, detail="Only course editors can pin comments")
    if comment.parent_id is not None:
        raise HTTPException(status_code=422, detail="Only top-level comments can be pinned")
    comment.is_pinned = not comment.is_pinned
    db_session.add(comment)
    await db_session.commit()
