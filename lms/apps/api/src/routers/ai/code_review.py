import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.events.database import get_db_session
from src.db.ai_code_reviews import (
    AICodeReview,
    CodeReviewHistory,
    CodeReviewQuota,
    CodeReviewRequest,
    CodeReviewResponse,
)
from src.db.courses.activities import Activity
from src.db.courses.assignments import AssignmentTask, AssignmentTaskTypeEnum
from src.db.courses.courses import Course
from src.db.users import PublicUser
from src.security.auth import get_authenticated_user, resolve_acting_user_id
from src.security.features_utils.resolve import resolve_feature
from src.security.features_utils.usage import _load_org_config_for_ai
from src.security.rbac import AccessAction, check_resource_access
from src.services.ai.code_review import (
    MAX_CODE_CHARS,
    get_quota,
    quota_exceeded,
    review_code,
    to_read,
)
from src.services.ai.llm import AINotConfiguredError
from src.services.courses.activities.access import verify_activity_reader_access_by_uuid
from src.services.security.rate_limiting import enforce_ai_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()

# One review at a time per student: a double click must not be charged twice.
_in_flight: set[int] = set()


async def _load_code_task(assignment_task_uuid: str, db_session: AsyncSession):
    row = (
        await db_session.execute(
            select(AssignmentTask, Activity, Course)
            .join(Activity, Activity.id == AssignmentTask.activity_id)  # type: ignore
            .join(Course, Course.id == AssignmentTask.course_id)  # type: ignore
            .where(AssignmentTask.assignment_task_uuid == assignment_task_uuid)
        )
    ).first()
    if not row or row[0].assignment_type != AssignmentTaskTypeEnum.CODE:
        raise HTTPException(status_code=404, detail="Code task not found")
    return row


@router.post(
    "/code-review",
    response_model=CodeReviewResponse,
    summary="AI review of the student's code in a code task",
    description="Advisory feedback; does not change the grade. Counts against the student's daily and monthly review limits.",
    responses={
        403: {"description": "AI is disabled or no access to the task"},
        404: {"description": "Code task not found"},
        413: {"description": "Code is too long"},
        422: {"description": "Empty code"},
        429: {"description": "Daily or monthly review limit reached"},
        502: {"description": "The AI model failed; nothing was counted"},
    },
)
async def api_code_review(
    body: CodeReviewRequest,
    request: Request,
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CodeReviewResponse:
    if not body.source_code.strip():
        raise HTTPException(status_code=422, detail="Write some code first")
    if len(body.source_code) > MAX_CODE_CHARS:
        raise HTTPException(status_code=413, detail=f"Code is longer than {MAX_CODE_CHARS} characters")

    task, activity, course = await _load_code_task(body.assignment_task_uuid, db_session)
    await verify_activity_reader_access_by_uuid(request, activity.activity_uuid, current_user, db_session)

    org_config = await _load_org_config_for_ai(course.org_id, db_session)
    if org_config is None or not resolve_feature("ai", org_config.config or {}, course.org_id)["enabled"]:
        raise HTTPException(status_code=403, detail="AI is not enabled for this organization")

    user_id = resolve_acting_user_id(current_user)
    quota = await get_quota(user_id, db_session)
    hit = quota_exceeded(quota)
    if hit:
        raise HTTPException(
            status_code=429,
            detail=f"{hit}_review_limit_reached",
        )
    if user_id in _in_flight:
        raise HTTPException(status_code=429, detail="review_in_progress")
    enforce_ai_rate_limit(current_user.id, course.org_id)

    _in_flight.add(user_id)
    try:
        review = await review_code(
            db_session=db_session,
            user_id=user_id,
            task=task,
            source_code=body.source_code,
            results=body.results,
            locale=body.locale,
        )
    except AINotConfiguredError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception:
        logger.exception("AI code review failed")
        raise HTTPException(status_code=502, detail="The review could not be created. Nothing was counted, please try again.")
    finally:
        _in_flight.discard(user_id)

    return CodeReviewResponse(review=review, quota=await get_quota(user_id, db_session))


@router.get(
    "/code-review/history",
    response_model=CodeReviewHistory,
    summary="My latest AI reviews of a code task, with my remaining quota",
    responses={403: {"description": "No access to the task"}, 404: {"description": "Code task not found"}},
)
async def api_code_review_history(
    request: Request,
    assignment_task_uuid: str,
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CodeReviewHistory:
    task, activity, _course = await _load_code_task(assignment_task_uuid, db_session)
    await verify_activity_reader_access_by_uuid(request, activity.activity_uuid, current_user, db_session)
    user_id = resolve_acting_user_id(current_user)
    rows = (
        await db_session.execute(
            select(AICodeReview)
            .where(AICodeReview.user_id == user_id, AICodeReview.assignment_task_id == task.id)
            .order_by(AICodeReview.id.desc())  # type: ignore
            .limit(5)
        )
    ).scalars().all()
    return CodeReviewHistory(reviews=[to_read(r) for r in rows], quota=await get_quota(user_id, db_session))


@router.get(
    "/code-review/grading",
    response_model=CodeReviewHistory,
    summary="A student's AI reviews of a code task (teachers)",
    description="Course editors only. The quota in the response is the student's.",
    responses={403: {"description": "Not a course editor"}, 404: {"description": "Code task not found"}},
)
async def api_code_review_for_grading(
    request: Request,
    assignment_task_uuid: str,
    user_id: int = Query(...),
    current_user: PublicUser = Depends(get_authenticated_user),
    db_session: AsyncSession = Depends(get_db_session),
) -> CodeReviewHistory:
    task, _activity, course = await _load_code_task(assignment_task_uuid, db_session)
    await check_resource_access(request, db_session, current_user, course.course_uuid, AccessAction.UPDATE)
    rows = (
        await db_session.execute(
            select(AICodeReview)
            .where(AICodeReview.user_id == user_id, AICodeReview.assignment_task_id == task.id)
            .order_by(AICodeReview.id.desc())  # type: ignore
            .limit(5)
        )
    ).scalars().all()
    return CodeReviewHistory(reviews=[to_read(r) for r in rows], quota=await get_quota(user_id, db_session))
