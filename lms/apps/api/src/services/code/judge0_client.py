"""Small async client for running code in Judge0.

Used by the AI code-task generator to run generated reference solutions, starter
code and "wrong" solutions. Everything runs inside the Judge0 sandbox (network
off, CPU/memory/wall-time limits set on the Judge0 side); nothing generated is
ever executed on the LMS host.

The student-facing endpoints in ``routers/code_execution.py`` talk to the same
Judge0 server and use the same credentials, but they raise HTTP errors; this
module raises ``Judge0Error`` so a service can decide what to do.
"""

from __future__ import annotations

import asyncio
import base64
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from config.config import get_learnhouse_config

logger = logging.getLogger(__name__)

JUDGE0_TIMEOUT = 40.0
DEFAULT_CONCURRENCY = 4
# Judge0 status ids (https://ce.judge0.com): 3 = Accepted (ran to completion; with
# no expected_output sent it only means "no error"), 4 = Wrong Answer,
# 5 = Time Limit Exceeded, 6 = Compilation Error, 7-12 = runtime errors,
# 13 = Internal Error, 14 = Exec Format Error.
STATUS_ACCEPTED = 3
_TRANSIENT_HTTP = {429, 502, 503, 504}


class Judge0Error(Exception):
    """Judge0 is unreachable, not configured, or answered with an error."""


@dataclass
class RunResult:
    status_id: int
    status: str
    stdout: str
    stderr: str
    compile_output: str
    time: Optional[float]
    memory: Optional[int]

    @property
    def ok(self) -> bool:
        return self.status_id == STATUS_ACCEPTED


def _config():
    cfg = get_learnhouse_config().judge0_config
    if not cfg:
        raise Judge0Error("Code execution is not configured (LEARNHOUSE_JUDGE0_API_URL).")
    return cfg


def _headers(cfg) -> dict:
    headers = {"Content-Type": "application/json"}
    if cfg.client_id:
        headers["X-Judge0-Client-ID"] = cfg.client_id
    if cfg.client_secret:
        headers["X-Judge0-Client-Secret"] = cfg.client_secret
    return headers


def is_configured() -> bool:
    try:
        return bool(get_learnhouse_config().judge0_config)
    except Exception:
        return False


def _b64(text: str) -> str:
    return base64.b64encode(text.encode("utf-8")).decode("ascii")


def _unb64(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return base64.b64decode(value).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _to_result(data: dict) -> RunResult:
    # Judge0 answers with base64 fields because compiler messages are not always
    # valid UTF-8 (g++ prints curly quotes in some locales); without base64 it
    # replies with {"error": "... cannot be converted to UTF-8"} and no status.
    status = data.get("status") or {}
    try:
        time_value = float(data["time"]) if data.get("time") is not None else None
    except (TypeError, ValueError):
        time_value = None
    return RunResult(
        status_id=int(status.get("id", 0)),
        status=str(status.get("description", "")),
        stdout=_unb64(data.get("stdout")),
        stderr=_unb64(data.get("stderr")),
        compile_output=_unb64(data.get("compile_output")),
        time=time_value,
        memory=data.get("memory"),
    )


async def _run_one(
    client: httpx.AsyncClient, cfg, language_id: int, source_code: str, stdin: str
) -> RunResult:
    url = f"{cfg.api_url}/submissions?wait=true&base64_encoded=true"
    payload = {
        "language_id": language_id,
        "source_code": _b64(source_code),
        "stdin": _b64(stdin),
    }
    last_error: Optional[str] = None
    for attempt in range(2):
        try:
            resp = await client.post(url, json=payload, headers=_headers(cfg))
        except httpx.HTTPError as exc:
            last_error = f"{type(exc).__name__}: {exc}"
        else:
            if resp.status_code in (200, 201):
                data = resp.json()
                if "status" not in data:
                    raise Judge0Error(f"Judge0 returned no status: {str(data)[:200]}")
                return _to_result(data)
            last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
            if resp.status_code not in _TRANSIENT_HTTP:
                break
        await asyncio.sleep(1.0 + attempt)
    raise Judge0Error(f"Judge0 request failed ({last_error})")


async def run_many(
    language_id: int,
    source_code: str,
    stdins: list[str],
    *,
    concurrency: int = DEFAULT_CONCURRENCY,
) -> list[RunResult]:
    """Run one program once per stdin, in order, at most ``concurrency`` at a time."""
    cfg = _config()
    semaphore = asyncio.Semaphore(max(1, concurrency))
    async with httpx.AsyncClient(timeout=JUDGE0_TIMEOUT) as client:

        async def one(stdin: str) -> RunResult:
            async with semaphore:
                return await _run_one(client, cfg, language_id, source_code, stdin)

        return list(await asyncio.gather(*[one(s) for s in stdins]))


def normalize_output(text: Optional[str]) -> str:
    """Same comparison rule the student grader uses (routers/code_execution.py).

    Lines are right-trimmed and trailing empty lines dropped, so ``"x\\n"`` and
    ``"x"`` match, while leading whitespace on a line is kept.
    """
    if not text:
        return ""
    lines = [line.rstrip() for line in text.splitlines()]
    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)
