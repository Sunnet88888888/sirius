from fastapi import APIRouter, Depends, Request, Response

from src.core.events.database import get_db_session
from src.db.activity_comments import (
    ActivityCommentCreate,
    ActivityCommentList,
    ActivityCommentRead,
    ActivityCommentUpdate,
    ActivityCommentVoteRead,
)
from src.security.auth import get_current_user
from src.services.courses.activities.comments import (
    create_activity_comment,
    delete_activity_comment,
    list_activity_comments,
    toggle_comment_pin,
    toggle_comment_vote,
    update_activity_comment,
)

router = APIRouter()


@router.get(
    "/activity/{activity_uuid}",
    response_model=ActivityCommentList,
    summary="List comments under a lesson",
    description="Readable by anyone who may open the lesson. `can_comment` tells whether the caller may post.",
    responses={401: {"description": "Authentication required"}, 403: {"description": "No access to the lesson"}, 404: {"description": "Lesson not found"}},
)
async def api_list_activity_comments(
    request: Request,
    activity_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ActivityCommentList:
    return await list_activity_comments(request, activity_uuid, user, db_session)


@router.post(
    "/activity/{activity_uuid}",
    response_model=ActivityCommentRead,
    summary="Comment on a lesson",
    description="Requires being enrolled in the course (or editing it). Replies notify the replied-to author; top-level comments notify the course authors.",
    responses={401: {"description": "Authentication required"}, 403: {"description": "Not enrolled"}, 422: {"description": "Empty or too long"}},
)
async def api_create_activity_comment(
    request: Request,
    activity_uuid: str,
    data: ActivityCommentCreate,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ActivityCommentRead:
    return await create_activity_comment(request, activity_uuid, data, user, db_session)


@router.put(
    "/{comment_uuid}",
    status_code=204,
    summary="Edit your comment",
    responses={403: {"description": "Not your comment"}, 404: {"description": "Comment not found"}},
)
async def api_update_activity_comment(
    request: Request,
    comment_uuid: str,
    data: ActivityCommentUpdate,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> Response:
    await update_activity_comment(request, comment_uuid, data, user, db_session)
    return Response(status_code=204)


@router.delete(
    "/{comment_uuid}",
    status_code=204,
    summary="Delete a comment",
    description="Authors delete their own; course editors delete any. Replies go with it.",
    responses={403: {"description": "Not allowed"}, 404: {"description": "Comment not found"}},
)
async def api_delete_activity_comment(
    request: Request,
    comment_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> Response:
    await delete_activity_comment(request, comment_uuid, user, db_session)
    return Response(status_code=204)


@router.post(
    "/{comment_uuid}/vote",
    response_model=ActivityCommentVoteRead,
    summary="Toggle your upvote on a comment",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Comment not found"}},
)
async def api_toggle_comment_vote(
    request: Request,
    comment_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ActivityCommentVoteRead:
    return await toggle_comment_vote(request, comment_uuid, user, db_session)


@router.post(
    "/{comment_uuid}/pin",
    status_code=204,
    summary="Toggle pinning of a top-level comment",
    description="Course editors only.",
    responses={403: {"description": "Not a course editor"}, 422: {"description": "Replies cannot be pinned"}},
)
async def api_toggle_comment_pin(
    request: Request,
    comment_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> Response:
    await toggle_comment_pin(request, comment_uuid, user, db_session)
    return Response(status_code=204)
