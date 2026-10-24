from typing import List, Optional

from pydantic import BaseModel, Field as PField
from sqlalchemy import Column, ForeignKey, Index, Integer, JSON, Text
from sqlmodel import Field, SQLModel


class AICodeReview(SQLModel, table=True):
    """One AI review of a student's code in a CODE assignment task.

    A row exists only for reviews that were actually delivered, so the rows
    double as the usage ledger for the per-student daily/monthly limits: a failed
    model call costs the student nothing."""

    __tablename__ = "aicodereview"
    __table_args__ = (
        Index("ix_aicodereview_user_created", "user_id", "creation_date"),
        Index("ix_aicodereview_task_user", "assignment_task_id", "user_id"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    review_uuid: str = Field(default="", index=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False)
    )
    assignment_task_id: int = Field(
        sa_column=Column(Integer, ForeignKey("assignmenttask.id", ondelete="CASCADE"), nullable=False)
    )
    language_id: int = 0
    source_code: str = Field(default="", sa_column=Column(Text, nullable=False))
    tests_passed: int = 0
    tests_total: int = 0
    review: dict = Field(default_factory=dict, sa_column=Column(JSON))
    model_name: str = ""
    creation_date: str = ""


# --- What the model returns (structured output) ---

class AIReviewScores(BaseModel):
    """Each score is an integer from 1 (poor) to 5 (excellent)."""

    correctness: int
    readability: int
    efficiency: int
    style: int


class AIReviewIssue(BaseModel):
    severity: str  # "error" | "warning" | "suggestion"
    # 1-based line in the numbered code the model was shown; null for general remarks
    line: Optional[int] = None
    title: str
    detail: str


class AICodeReviewDraft(BaseModel):
    summary: str
    scores: AIReviewScores
    issues: List[AIReviewIssue] = PField(default_factory=list)
    tips: List[str] = PField(default_factory=list)
    # A short improved version of the weakest part; only once all visible tests pass
    improved_snippet: Optional[str] = None


# --- API ---

class ReviewTestResult(BaseModel):
    label: str = PField(max_length=200)
    passed: bool
    actual: Optional[str] = PField(default=None, max_length=400)
    expected: Optional[str] = PField(default=None, max_length=400)
    error: Optional[str] = PField(default=None, max_length=400)


class CodeReviewRequest(BaseModel):
    assignment_task_uuid: str = PField(max_length=255)
    source_code: str
    results: List[ReviewTestResult] = PField(default_factory=list, max_length=30)
    locale: str = PField(default="en", max_length=16)


class CodeReviewQuota(BaseModel):
    daily_limit: int
    daily_used: int
    monthly_limit: int
    monthly_used: int


class CodeReviewRead(BaseModel):
    review_uuid: str
    summary: str
    scores: AIReviewScores
    issues: List[AIReviewIssue]
    tips: List[str]
    improved_snippet: Optional[str] = None
    tests_passed: int
    tests_total: int
    creation_date: str


class CodeReviewResponse(BaseModel):
    review: CodeReviewRead
    quota: CodeReviewQuota


class CodeReviewHistory(BaseModel):
    reviews: List[CodeReviewRead]
    quota: CodeReviewQuota
