from fastapi import APIRouter, Depends, HTTPException

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser
from src.security.auth import get_current_user
from src.services.users.activity_calendar import ActivityCalendar, get_activity_calendar

router = APIRouter()


@router.get(
    "/me",
    response_model=ActivityCalendar,
    summary="My learning activity per day (last 365 days)",
    description="Completed lesson steps, saved code runs, AI code reviews and lesson comments, per UTC day, plus current and longest streak.",
    responses={401: {"description": "Authentication required"}},
)
async def api_my_activity_calendar(
    user=Depends(get_current_user),
    db_session=Depends(get_db_session),
) -> ActivityCalendar:
    if isinstance(user, AnonymousUser):
        raise HTTPException(status_code=401, detail="Authentication required")
    return await get_activity_calendar(user.id, db_session)
