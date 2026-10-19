"""Background jobs for AI code-task generation.

Generating and verifying a code task takes tens of seconds (model calls plus
many Judge0 runs), longer than a request should stay open. The API starts a job,
returns its id at once, and the web app polls for progress and the result.

State lives in this process's memory and is dropped after ``JOB_TTL_SECONDS``;
a restart of the API loses running jobs (the poll then answers 404 and the
credits of an interrupted job are not refunded; acceptable for a teacher tool
and simple to reason about). Concurrency is bounded so generation cannot starve
student submissions on the shared Judge0.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Optional
from uuid import uuid4

from src.security.features_utils.usage import refund_ai_credit
from src.services.ai.code_task_gen import (
    CodeTaskDropped,
    generate_code_task,
)
from src.services.code.judge0_client import Judge0Error

logger = logging.getLogger(__name__)

JOB_TTL_SECONDS = 3600
MAX_CONCURRENT_JOBS = 2
PER_TASK_TIMEOUT_SECONDS = 300
CREDIT_COST_PER_TASK = 4

_semaphore = asyncio.Semaphore(MAX_CONCURRENT_JOBS)


@dataclass
class CodeTaskJob:
    job_id: str
    user_id: int
    org_id: int
    num_tasks: int
    status: str = "queued"  # queued | running | done | failed
    progress: list[dict] = field(default_factory=list)
    tasks: list[dict] = field(default_factory=list)
    dropped: list[dict] = field(default_factory=list)
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)


_JOBS: dict[str, CodeTaskJob] = {}


def _purge() -> None:
    now = time.time()
    for job_id in [j for j, job in _JOBS.items() if now - job.created_at > JOB_TTL_SECONDS]:
        _JOBS.pop(job_id, None)


def get_job(job_id: str) -> Optional[CodeTaskJob]:
    _purge()
    return _JOBS.get(job_id)


def user_has_active_job(user_id: int) -> bool:
    _purge()
    return any(j.user_id == user_id and j.status in ("queued", "running") for j in _JOBS.values())


async def _run(job: CodeTaskJob, kwargs: dict) -> None:
    async with _semaphore:
        job.status = "running"
        accepted = 0
        try:
            for index in range(job.num_tasks):

                async def progress(stage: str, message: str, _i: int = index) -> None:
                    job.progress.append({"task_index": _i, "stage": stage, "message": message})

                try:
                    task = await asyncio.wait_for(
                        generate_code_task(progress=progress, **kwargs),
                        timeout=PER_TASK_TIMEOUT_SECONDS,
                    )
                    job.tasks.append(task.model_dump())
                    accepted += 1
                except CodeTaskDropped as exc:
                    job.dropped.append({"task_index": index, "reason": str(exc)[:400]})
                except asyncio.TimeoutError:
                    job.dropped.append({"task_index": index, "reason": "Timed out while verifying."})
            job.status = "done"
        except Judge0Error as exc:
            logger.warning("Code task job %s: Judge0 unavailable: %s", job.job_id, exc)
            job.status = "failed"
            job.error = "Code verification is not available right now. Please try again later."
        except Exception:
            logger.exception("Code task job %s failed", job.job_id)
            job.status = "failed"
            job.error = "Generation failed. Please try again."
        finally:
            # Only tasks that passed verification are charged.
            unused = (job.num_tasks - accepted) * CREDIT_COST_PER_TASK
            if unused > 0:
                try:
                    refund_ai_credit(job.org_id, unused)
                except Exception:
                    logger.warning("Could not refund credits for job %s", job.job_id, exc_info=True)


def start_job(*, user_id: int, org_id: int, num_tasks: int, generation_kwargs: dict) -> CodeTaskJob:
    _purge()
    job = CodeTaskJob(job_id=str(uuid4()), user_id=user_id, org_id=org_id, num_tasks=num_tasks)
    _JOBS[job.job_id] = job
    asyncio.get_running_loop().create_task(_run(job, generation_kwargs))
    return job
