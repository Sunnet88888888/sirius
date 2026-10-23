from fastapi import APIRouter, Depends, Request, Response

from src.core.events.database import get_db_session
from src.db.course_favorites import CourseFavoritesRead
from src.security.auth import get_current_user
from src.services.courses.favorites import (
    add_favorite_course,
    list_favorite_course_uuids,
    remove_favorite_course,
)

router = APIRouter()


@router.get(
    "/",
    response_model=CourseFavoritesRead,
    summary="List favourite courses",
    description="Course uuids the current user has marked as favourite, newest first.",
    responses={
        200: {"description": "Favourite course uuids.", "model": CourseFavoritesRead},
        401: {"description": "Authentication required"},
    },
)
async def api_list_favorite_courses(
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> CourseFavoritesRead:
    return CourseFavoritesRead(
        course_uuids=await list_favorite_course_uuids(user, db_session)
    )


@router.put(
    "/{course_uuid}",
    status_code=204,
    summary="Add a course to favourites",
    description="Idempotent. The user must be allowed to read the course.",
    responses={
        204: {"description": "Course is in the favourites."},
        401: {"description": "Authentication required"},
        403: {"description": "User cannot read this course"},
        404: {"description": "Course not found"},
    },
)
async def api_add_favorite_course(
    request: Request,
    course_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> Response:
    await add_favorite_course(request, course_uuid, user, db_session)
    return Response(status_code=204)


@router.delete(
    "/{course_uuid}",
    status_code=204,
    summary="Remove a course from favourites",
    description="Idempotent.",
    responses={
        204: {"description": "Course is not in the favourites."},
        401: {"description": "Authentication required"},
        404: {"description": "Course not found"},
    },
)
async def api_remove_favorite_course(
    course_uuid: str,
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> Response:
    await remove_favorite_course(course_uuid, user, db_session)
    return Response(status_code=204)
