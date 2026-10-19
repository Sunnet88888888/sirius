"""Schemas for AI-generated, Judge0-validated code tasks."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from src.services.ai.schemas.limits import AI_MESSAGE_MAX_CHARS

Difficulty = Literal["easy", "medium", "hard"]


# --- What the model returns (structured output) ---

class AICodeTestInput(BaseModel):
    label: str
    # Raw standard input for this test. Expected output is NOT asked from the
    # model; it is computed by running the reference solution in Judge0.
    stdin: str
    kind: Literal["sample", "typical", "edge", "large"] = "typical"
    # Only for "sample" tests (the ones shown to students as examples). It is
    # used to cross-check the reference solution, never as the stored answer.
    expected_stdout: Optional[str] = None


class AICodeTaskDraft(BaseModel):
    title: str
    # Student-facing problem text: story, input format, output format and
    # constraints. It must NOT contain example input/output (shown separately).
    statement: str
    hint: str = ""
    starter_code: str
    solution_code: str
    tests: List[AICodeTestInput] = Field(default_factory=list)


class AICodeMutant(BaseModel):
    description: str
    code: str


class AICodeMutants(BaseModel):
    mutants: List[AICodeMutant] = Field(default_factory=list)


# --- Request / response ---

class GenerateCodeTaskRequest(BaseModel):
    org_id: int
    course_uuid: str
    prompt: str = Field(max_length=AI_MESSAGE_MAX_CHARS)
    language_id: int = 71
    difficulty: Difficulty = "easy"
    num_tasks: int = 1


class CodeTaskJobStart(BaseModel):
    job_id: str


class CodeTaskProgress(BaseModel):
    task_index: int
    stage: str
    message: str


class CodeTaskDropped(BaseModel):
    task_index: int
    reason: str


class CodeTaskJobStatus(BaseModel):
    job_id: str
    status: Literal["queued", "running", "done", "failed"]
    progress: List[CodeTaskProgress] = Field(default_factory=list)
    tasks: List[dict] = Field(default_factory=list)
    dropped: List[CodeTaskDropped] = Field(default_factory=list)
    error: Optional[str] = None
