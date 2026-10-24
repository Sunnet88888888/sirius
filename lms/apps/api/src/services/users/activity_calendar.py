"""Per-day learning activity of a user (the data behind the LeetCode-style calendar).

A day counts for what the learner actually did, not for merely visiting:
completed lesson steps, code runs saved, AI code reviews received and lesson
comments written. Days are UTC calendar days. Everything is aggregated in SQL,
one query per source, then merged here.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Dict, List

from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.activity_comments import ActivityComment
from src.db.ai_code_reviews import AICodeReview
from src.db.code_submissions import CodeSubmission
from src.db.trail_steps import TrailStep

WINDOW_DAYS = 365


class ActivityDay(BaseModel):
    date: str  # YYYY-MM-DD
    count: int


class ActivityCalendar(BaseModel):
    start: str
    end: str
    days: List[ActivityDay]  # only days with activity
    total_actions: int
    active_days: int
    current_streak: int
    longest_streak: int


async def _per_day(db_session: AsyncSession, column, user_column, user_id: int, since_iso: str, *extra) -> Dict[str, int]:
    """Rows per YYYY-MM-DD for one source. The date columns are ISO-8601 strings,
    so their first 10 characters are the UTC day."""
    day = func.substr(column, 1, 10)
    rows = (
        await db_session.execute(
            select(day, func.count())  # type: ignore
            .where(user_column == user_id, column >= since_iso, *extra)
            .group_by(day)
        )
    ).all()
    return {d: n for d, n in rows}


def compute_streaks(active: set[date], today: date) -> tuple[int, int]:
    """(current, longest). The current streak is still alive if the learner was
    active yesterday and has not had the chance to be active today yet."""
    longest = run = 0
    prev = None
    for d in sorted(active):
        run = run + 1 if prev is not None and d - prev == timedelta(days=1) else 1
        longest = max(longest, run)
        prev = d
    cursor = today if today in active else today - timedelta(days=1)
    current = 0
    while cursor in active:
        current += 1
        cursor -= timedelta(days=1)
    return current, longest


async def get_activity_calendar(user_id: int, db_session: AsyncSession) -> ActivityCalendar:
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=WINDOW_DAYS - 1)
    since = start.isoformat()

    counts: Dict[str, int] = {}
    sources = [
        await _per_day(db_session, TrailStep.creation_date, TrailStep.user_id, user_id, since, TrailStep.complete == True),  # noqa: E712
        await _per_day(db_session, CodeSubmission.created_at, CodeSubmission.user_id, user_id, since),
        await _per_day(db_session, AICodeReview.creation_date, AICodeReview.user_id, user_id, since),
        await _per_day(db_session, ActivityComment.creation_date, ActivityComment.user_id, user_id, since),
    ]
    for source in sources:
        for d, n in source.items():
            counts[d] = counts.get(d, 0) + n

    # Keep only well-formed days inside the window (defensive against odd legacy strings).
    days: List[ActivityDay] = []
    active: set[date] = set()
    for d, n in sorted(counts.items()):
        try:
            parsed = date.fromisoformat(d)
        except ValueError:
            continue
        if start <= parsed <= today:
            days.append(ActivityDay(date=d, count=n))
            active.add(parsed)

    current, longest = compute_streaks(active, today)
    return ActivityCalendar(
        start=start.isoformat(),
        end=today.isoformat(),
        days=days,
        total_actions=sum(d.count for d in days),
        active_days=len(days),
        current_streak=current,
        longest_streak=longest,
    )
