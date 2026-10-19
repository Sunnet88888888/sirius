"""AI generation of programming tasks, verified with Judge0.

A model writes the statement, a starter skeleton, a reference solution and the
test INPUTS. The expected outputs are never taken from the model: they are the
real output of the reference solution, computed in Judge0. A task is only
returned when it passes these checks:

- the test set has a usable shape (5-12 tests, at least 2 visible and 2 hidden,
  no duplicate inputs, inputs of reasonable size),
- the reference solution runs cleanly on every test and prints something,
- two runs of the reference solution give the same output (deterministic),
- the sample outputs the model wrote for the statement agree with Judge0,
- the starter code does NOT already pass every test,
- (reported, not blocking) deliberately wrong solutions are caught by the tests.

Failures are fed back to the model for up to ``MAX_REPAIRS`` repair rounds. A
task that still fails is dropped. Everything generated runs only inside Judge0.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Awaitable, Callable, Optional
from uuid import uuid4

from src.services.ai.llm import generate
from src.services.ai.schemas.assignment import GeneratedTask
from src.services.ai.schemas.code_task import (
    AICodeMutants,
    AICodeTaskDraft,
)
from src.services.code.judge0_client import (
    Judge0Error,
    RunResult,
    normalize_output,
    run_many,
)

logger = logging.getLogger(__name__)

MAX_REPAIRS = 2
MIN_TESTS = 5
MAX_TESTS = 12
MIN_VISIBLE = 2
MIN_HIDDEN = 2
MAX_VISIBLE = 3
MAX_STDIN_CHARS = 2000
MAX_SOURCE_CHARS = 20000
MUTANT_COUNT = 2

# Judge0 CE 1.13 language ids the generator supports, with what the model needs
# to know to write code that actually runs there.
CODE_LANGUAGES: dict[int, dict[str, str]] = {
    71: {
        "name": "Python 3",
        "guidance": "Python 3.8. Read input with input() or sys.stdin. Standard library only.",
    },
    63: {
        "name": "JavaScript (Node.js)",
        "guidance": (
            "Node.js 12. Read all input with require('fs').readFileSync(0, 'utf8'). "
            "No external modules."
        ),
    },
    62: {
        "name": "Java",
        "guidance": (
            "Java (OpenJDK 13). The public class must be named Main. Read input with "
            "java.util.Scanner or BufferedReader."
        ),
    },
    54: {
        "name": "C++",
        "guidance": "C++17 compiled with g++ 9. Read with cin, write with cout. Include the headers you use.",
    },
}

DIFFICULTY_TEXT = {
    "easy": "easy: a beginner exercise (loops, conditions, simple arithmetic or strings)",
    "medium": "medium: needs a small algorithm or careful handling of data (lists, sorting, counting, simple recursion)",
    "hard": "hard: needs a real algorithmic idea, but the solution must still run in well under a second",
}

_DRAFT_SYSTEM_PROMPT = """You are an expert programming teacher writing an auto-graded exercise.

The program reads from standard input and writes to standard output. Students are graded by running
their program on hidden test inputs and comparing the printed output with the expected output.

You must return:
- title: short.
- statement: the student-facing problem text: the task, the exact input format, the exact output
  format, and constraints. Do NOT include example inputs/outputs in it (the platform shows them
  separately from your tests).
- hint: one useful hint that does not give the solution away.
- starter_code: a skeleton the student completes. It must compile/run, read the input if that helps,
  and contain comments about what to do, but it must NOT solve the task.
- solution_code: a complete, correct reference solution.
- tests: between 6 and 10 tests. Each has a label, the raw stdin, and a kind:
    * "sample": 2 or 3 small, easy tests. For a sample ALSO give expected_stdout (exactly what the
      correct solution prints). These are shown to students as examples.
    * "typical", "edge", "large": tests for normal input, boundary/corner cases (empty-ish input,
      one element, negatives, duplicates, maximum size) and larger input. For these leave
      expected_stdout empty: the platform computes it by running your reference solution.
  Include at least 3 non-sample tests. Every test input must be different.

Hard rules (a violation makes the exercise unusable):
- The correct output for every input must be UNIQUE and fully determined by the statement. No
  "print any valid answer", no randomness, no dates or times, no environment access, no files, no network.
- Real-number output must state the exact format (for example "exactly two digits after the decimal
  point") and your solution must print exactly that.
- Keep every test input under 2000 characters and make the solution finish in well under a second.
- The statement must be consistent with the reference solution and with the tests.
- Write the statement, hint and comments in the same language as the teacher's request.
- Code identifiers and code comments may be English. Return ONLY the structured result."""

_MUTANT_SYSTEM_PROMPT = """You help check how good a set of tests is.
Given a programming problem and its correct solution, write wrong solutions of the kind students
often write: an off-by-one error, a missed edge case, a wrong condition, integer overflow or
truncation, a missing step. Each wrong solution must compile and run without errors on normal input,
and must be wrong on at least one reasonable input. Return ONLY the structured result."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def supported_language_ids() -> list[int]:
    return list(CODE_LANGUAGES.keys())


def _fmt_run(result: RunResult) -> str:
    detail = result.compile_output or result.stderr or ""
    detail = detail.strip().replace("\n", " ")[:300]
    return f"{result.status}" + (f": {detail}" if detail else "")


def _shape_issues(draft: AICodeTaskDraft) -> list[str]:
    """Structural problems with the model's draft (before anything is executed)."""
    issues: list[str] = []
    if not draft.statement.strip():
        issues.append("The statement is empty.")
    if not draft.solution_code.strip():
        issues.append("The reference solution is empty.")
    if not draft.starter_code.strip():
        issues.append("The starter code is empty.")
    if len(draft.solution_code) > MAX_SOURCE_CHARS or len(draft.starter_code) > MAX_SOURCE_CHARS:
        issues.append("The solution or starter code is too long.")
    tests = draft.tests
    if not (MIN_TESTS <= len(tests) <= MAX_TESTS):
        issues.append(f"Provide between {MIN_TESTS} and {MAX_TESTS} tests (you gave {len(tests)}).")
    seen: set[str] = set()
    for i, t in enumerate(tests, 1):
        if len(t.stdin) > MAX_STDIN_CHARS:
            issues.append(f"Test {i} input is longer than {MAX_STDIN_CHARS} characters.")
        key = t.stdin.strip()
        if key in seen:
            issues.append(f"Test {i} repeats the input of an earlier test.")
        seen.add(key)
    samples = [t for t in tests if t.kind == "sample"]
    if len(samples) < MIN_VISIBLE:
        issues.append("Provide at least 2 tests of kind 'sample'.")
    if len(tests) - min(len(samples), MAX_VISIBLE) < MIN_HIDDEN:
        issues.append("Provide at least 2 non-sample tests (they are hidden from students).")
    for t in samples:
        if not (t.expected_stdout or "").strip():
            issues.append(f"Sample test '{t.label}' needs expected_stdout.")
    return issues


def _visibility(draft: AICodeTaskDraft) -> list[bool]:
    """True = visible to students. Samples are visible (at most MAX_VISIBLE)."""
    visible_budget = MAX_VISIBLE
    flags: list[bool] = []
    for t in draft.tests:
        if t.kind == "sample" and visible_budget > 0:
            flags.append(True)
            visible_budget -= 1
        else:
            flags.append(False)
    return flags


def _build_task(
    draft: AICodeTaskDraft,
    language_id: int,
    expected: list[str],
    report: dict,
) -> GeneratedTask:
    flags = _visibility(draft)
    test_cases = []
    for t, exp, visible in zip(draft.tests, expected, flags):
        test_cases.append(
            {
                "id": f"tc_{uuid4()}",
                "label": t.label.strip() or "Test",
                "stdin": t.stdin,
                "expectedStdout": exp,
                "hidden": not visible,
                "weight": 1,
            }
        )
    contents = {
        "language_id": language_id,
        "starter_code": draft.starter_code,
        "solution_code": draft.solution_code,
        "grading_mode": "equal_weight",
        "test_cases": test_cases,
        "allow_student_run": True,
        "show_test_details_on_fail": True,
        "show_hidden_test_count": True,
        "require_passing_to_submit": False,
        # Teacher-facing evidence; stripped from every student payload.
        "ai_validation": report,
    }
    return GeneratedTask(
        title=draft.title.strip(),
        description=draft.statement.strip(),
        hint=(draft.hint or "").strip(),
        assignment_type="CODE",
        contents=contents,
        max_grade_value=100,
    )


# ---------------------------------------------------------------------------
# Model calls
# ---------------------------------------------------------------------------

async def _draft(
    *,
    model_name: str,
    language_id: int,
    difficulty: str,
    prompt: str,
    context: str,
    previous: Optional[AICodeTaskDraft] = None,
    feedback: Optional[str] = None,
) -> AICodeTaskDraft:
    lang = CODE_LANGUAGES[language_id]
    user_prompt = (
        f"Programming language: {lang['name']}. {lang['guidance']}\n"
        f"Difficulty: {DIFFICULTY_TEXT[difficulty]}.\n"
        f"Teacher's request: {prompt.strip()}\n"
    )
    if context:
        user_prompt += f"\nCourse content for context (the exercise should fit it):\n{context}\n"
    if previous is not None and feedback:
        user_prompt += (
            "\nYour previous draft was checked by running it and it failed.\n"
            f"Problems found:\n{feedback}\n\n"
            "Previous draft (JSON):\n"
            f"{previous.model_dump_json()}\n\n"
            "Return a corrected, complete draft that fixes every problem."
        )
    return await generate(
        model_name=model_name,
        user_prompt=user_prompt,
        system_prompt=_DRAFT_SYSTEM_PROMPT,
        output_type=AICodeTaskDraft,
        temperature=0.4,
    )


async def _mutants(model_name: str, language_id: int, draft: AICodeTaskDraft) -> AICodeMutants:
    lang = CODE_LANGUAGES[language_id]
    user_prompt = (
        f"Language: {lang['name']}. {lang['guidance']}\n"
        f"Write {MUTANT_COUNT} different wrong solutions.\n\n"
        f"Problem statement:\n{draft.statement}\n\n"
        f"Correct solution:\n{draft.solution_code}\n"
    )
    return await generate(
        model_name=model_name,
        user_prompt=user_prompt,
        system_prompt=_MUTANT_SYSTEM_PROMPT,
        output_type=AICodeMutants,
        temperature=0.7,
    )


# ---------------------------------------------------------------------------
# Validation against Judge0
# ---------------------------------------------------------------------------

ProgressFn = Callable[[str, str], Awaitable[None]]


async def _noop_progress(_stage: str, _message: str) -> None:
    return None


async def _validate_with_judge0(
    draft: AICodeTaskDraft, language_id: int, progress: ProgressFn
) -> tuple[list[str], list[str], dict]:
    """Run the draft in Judge0. Returns (issues, expected_outputs, facts)."""
    issues: list[str] = []
    stdins = [t.stdin for t in draft.tests]
    runs = 0

    await progress("reference", "Running the reference solution")
    first = await run_many(language_id, draft.solution_code, stdins)
    runs += len(stdins)
    bad = [(i, r) for i, r in enumerate(first) if not r.ok]
    for i, r in bad:
        issues.append(f"The reference solution failed on test {i + 1} ('{draft.tests[i].label}'): {_fmt_run(r)}")
    empty = [i for i, r in enumerate(first) if r.ok and not normalize_output(r.stdout)]
    for i in empty:
        issues.append(f"The reference solution printed nothing on test {i + 1}; every test needs non-empty output.")
    if issues:
        return issues, [], {"judge0_runs": runs}

    expected = [normalize_output(r.stdout) for r in first]

    await progress("determinism", "Checking the output is reproducible")
    second = await run_many(language_id, draft.solution_code, stdins)
    runs += len(stdins)
    for i, (a, b) in enumerate(zip(first, second)):
        if not b.ok or normalize_output(b.stdout) != expected[i]:
            issues.append(
                f"The reference solution gave different output when run twice on test {i + 1}. "
                "The output must be fully deterministic."
            )

    # Sample outputs the model wrote for the statement must match reality.
    sample_mismatch = False
    for i, t in enumerate(draft.tests):
        if t.kind == "sample" and (t.expected_stdout or "").strip():
            if normalize_output(t.expected_stdout) != expected[i]:
                sample_mismatch = True
                issues.append(
                    f"Sample test {i + 1} ('{t.label}'): you expected {normalize_output(t.expected_stdout)!r} "
                    f"but the reference solution prints {expected[i]!r}. Make the statement and the solution agree."
                )

    await progress("starter", "Checking the starter code does not already solve it")
    starter = await run_many(language_id, draft.starter_code, stdins)
    runs += len(stdins)
    starter_passes = sum(
        1 for i, r in enumerate(starter) if r.ok and normalize_output(r.stdout) == expected[i]
    )
    if starter_passes == len(stdins):
        issues.append("The starter code already passes every test. Remove part of the solution from it.")

    facts = {
        "judge0_runs": runs,
        "deterministic": not any("different output when run twice" in x for x in issues),
        "samples_agree": not sample_mismatch,
        "starter_pass_count": starter_passes,
        "max_time": max((r.time or 0.0 for r in first), default=0.0),
    }
    return issues, expected, facts


async def _check_mutants(
    model_name: str,
    language_id: int,
    draft: AICodeTaskDraft,
    expected: list[str],
    progress: ProgressFn,
) -> dict:
    """Ask for wrong solutions and see whether the tests catch them (non-blocking)."""
    await progress("mutants", "Checking that the tests catch wrong solutions")
    try:
        mutants = await _mutants(model_name, language_id, draft)
    except Exception:
        logger.info("Mutant generation failed; skipping the check", exc_info=True)
        return {"tried": 0, "killed": 0, "skipped": True}
    stdins = [t.stdin for t in draft.tests]
    tried = killed = 0
    for m in mutants.mutants[:MUTANT_COUNT]:
        if not m.code.strip() or len(m.code) > MAX_SOURCE_CHARS:
            continue
        try:
            runs = await run_many(language_id, m.code, stdins)
        except Judge0Error:
            continue
        # A wrong solution only counts when it actually runs; one that does not
        # even compile proves nothing about the tests.
        if not any(r.ok for r in runs):
            continue
        tried += 1
        if any((not r.ok) or normalize_output(r.stdout) != expected[i] for i, r in enumerate(runs)):
            killed += 1
    return {"tried": tried, "killed": killed, "skipped": False}


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

class CodeTaskDropped(Exception):
    """The task could not be validated within the repair budget."""


async def generate_code_task(
    *,
    model_name: str,
    language_id: int,
    difficulty: str,
    prompt: str,
    context: str = "",
    progress: ProgressFn = _noop_progress,
) -> GeneratedTask:
    """Generate ONE validated code task, or raise ``CodeTaskDropped``.

    ``Judge0Error`` is propagated unchanged: it means validation could not run at
    all, which is different from the model producing a bad task.
    """
    if language_id not in CODE_LANGUAGES:
        raise ValueError(f"Unsupported language id {language_id}")

    draft: Optional[AICodeTaskDraft] = None
    feedback: Optional[str] = None
    last_issues: list[str] = []
    for attempt in range(MAX_REPAIRS + 1):
        await progress("draft", "Writing the exercise" if attempt == 0 else f"Fixing the exercise (round {attempt})")
        draft = await _draft(
            model_name=model_name,
            language_id=language_id,
            difficulty=difficulty,
            prompt=prompt,
            context=context,
            previous=draft if feedback else None,
            feedback=feedback,
        )

        issues = _shape_issues(draft)
        expected: list[str] = []
        facts: dict = {}
        if not issues:
            issues, expected, facts = await _validate_with_judge0(draft, language_id, progress)
        if issues:
            last_issues = issues
            feedback = "\n".join(f"- {x}" for x in issues[:8])
            logger.info("AI code task attempt %s failed validation: %s", attempt + 1, issues[:3])
            continue

        mutants = await _check_mutants(model_name, language_id, draft, expected, progress)
        warnings: list[str] = []
        if mutants["tried"] and mutants["killed"] < mutants["tried"]:
            warnings.append(
                "Some deliberately wrong solutions pass all tests. Consider adding tests before publishing."
            )
        flags = _visibility(draft)
        report = {
            "validated": True,
            "validated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "model": model_name,
            "language_id": language_id,
            "difficulty": difficulty,
            "attempts": attempt + 1,
            "tests_total": len(draft.tests),
            "tests_visible": sum(1 for f in flags if f),
            "tests_hidden": sum(1 for f in flags if not f),
            "reference_passed": len(draft.tests),
            "deterministic": facts.get("deterministic", True),
            "samples_agree": facts.get("samples_agree", True),
            "starter_passes": facts.get("starter_pass_count", 0),
            "mutants_tried": mutants["tried"],
            "mutants_killed": mutants["killed"],
            "judge0_runs": facts.get("judge0_runs", 0),
            "warnings": warnings,
        }
        await progress("done", "Verified")
        return _build_task(draft, language_id, expected, report)

    raise CodeTaskDropped("; ".join(last_issues[:3]) or "validation failed")
