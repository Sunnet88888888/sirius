from fastapi import APIRouter, Depends, Query, Response

from src.core.events.database import get_db_session
from src.db.notifications import NotificationList, UnreadCountRead
from src.security.auth import get_current_user
from src.services.notifications.notifications import (
    get_unread_count,
    list_notifications,
    mark_all_read,
    mark_read,
)

router = APIRouter()


@router.get(
    "/",
    response_model=NotificationList,
    summary="List my notifications",
    description="Newest first, with the unread count.",
    responses={401: {"description": "Authentication required"}},
)
async def api_list_notifications(
    limit: int = Query(30, ge=1, le=100),
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> NotificationList:
    return await list_notifications(user, db_session, limit)


@router.get(
    "/unread-count",
    response_model=UnreadCountRead,
    summary="Number of unread notifications",
    responses={401: {"description": "Authentication required"}},
)
async def api_unread_count(
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> UnreadCountRead:
    return await get_unread_count(user, db_session)


@router.post("/read-all", status_code=204, summary="Mark all my notifications as read")
async def api_mark_all_read(
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> Response:
    await mark_all_read(user, db_session)
    return Response(status_code=204)


@router.post("/{notification_uuid}/read", status_code=204, summary="Mark one notification as read")
async def api_mark_read(
    notification_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> Response:
    await mark_read(notification_uuid, user, db_session)
    return Response(status_code=204)
