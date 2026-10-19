"""Tests for src/services/ai/code_task_gen.py (Judge0-verified code tasks).

The model and Judge0 are replaced by small fakes, so these tests check the
validation rules themselves: where expected outputs come from, what makes a
draft fail, how repair works, and what ends up in the saved task.
"""

import asyncio

import pytest

import src.services.ai.code_task_gen as cg
import src.services.ai.code_task_jobs as jobs
from src.services.ai.schemas.assignment import GeneratedTask
from src.services.ai.schemas.code_task import (
    AICodeMutant,
    AICodeMutants,
    AICodeTaskDraft,
    AICodeTestInput,
)
from src.services.code.judge0_client import Judge0Error, RunResult

pytestmark = pytest.mark.asyncio

OK = 3


def run(stdout="", status=OK, desc="Accepted", stderr="", compile_output=""):
    return RunResult(
        status_id=status, status=desc, stdout=stdout, stderr=stderr,
        compile_output=compile_output, time=0.01, memory=1000,
    )


def make_draft(**over):
    """A draft whose "program" prints the number of characters of stdin."""
    tests = [
        AICodeTestInput(label="Sample 1", stdin="ab", kind="sample", expected_stdout="2"),
        AICodeTestInput(label="Sample 2", stdin="abcd", kind="sample", expected_stdout="4"),
        AICodeTestInput(label="Typical", stdin="abcdef", kind="typical"),
        AICodeTestInput(label="Edge", stdin="a", kind="edge"),
        AICodeTestInput(label="Large", stdin="x" * 50, kind="large"),
    ]
    data = dict(
        title="Count characters",
        statement="Read a word and print how many characters it has.",
        hint="Use len().",
        starter_code="STARTER",
        solution_code="SOLUTION",
        tests=tests,
    )
    data.update(over)
    return AICodeTaskDraft(**data)


class FakeJudge0:
    """Pretends to be Judge0: a program is identified by its source text."""

    def __init__(self, behaviours=None):
        # source -> callable(stdin, call_number) -> RunResult
        self.behaviours = behaviours or {}
        self.calls: dict[str, int] = {}

    async def __call__(self, language_id, source, stdins, **kw):
        n = self.calls.get(source, 0) + 1
        self.calls[source] = n
        fn = self.behaviours.get(source)
        if fn is None:
            if source.startswith("SOLUTION"):
                fn = lambda s, n: run(str(len(s)))  # noqa: E731
            elif source.startswith("STARTER"):
                fn = lambda s, n: run("")  # noqa: E731
            else:
                fn = lambda s, n: run(str(len(s) + 1))  # noqa: E731  (a wrong solution)
        return [fn(s, n) for s in stdins]


class FakeModel:
    """Returns queued drafts / mutants and records the prompts it was given."""

    def __init__(self, drafts, mutants=None):
        self.drafts = list(drafts)
        self.mutants = mutants if mutants is not None else AICodeMutants(
            mutants=[AICodeMutant(description="off by one", code="MUTANT1"),
                     AICodeMutant(description="always zero", code="MUTANT2")]
        )
        self.prompts: list[str] = []

    async def __call__(self, *, user_prompt, output_type, **kw):
        self.prompts.append(user_prompt)
        if output_type is AICodeMutants:
            return self.mutants
        return self.drafts.pop(0)


@pytest.fixture
def patch_env(monkeypatch):
    def apply(model, judge0):
        monkeypatch.setattr(cg, "generate", model)
        monkeypatch.setattr(cg, "run_many", judge0)

    return apply


async def gen(**kw):
    return await cg.generate_code_task(
        model_name="m", language_id=71, difficulty="easy", prompt="count characters", **kw
    )


# --- happy path -------------------------------------------------------------

async def test_expected_outputs_come_from_judge0_not_the_model(patch_env):
    draft = make_draft()
    # The model also proposes expected_stdout for samples; make the model's
    # non-sample tests carry a wrong value that must be ignored.
    draft.tests[2].expected_stdout = "999"
    patch_env(FakeModel([draft]), FakeJudge0())
    task = await gen()
    assert isinstance(task, GeneratedTask) and task.assignment_type == "CODE"
    tcs = task.contents["test_cases"]
    assert [t["expectedStdout"] for t in tcs] == ["2", "4", "6", "1", "50"]


async def test_task_shape_and_visibility(patch_env):
    patch_env(FakeModel([make_draft()]), FakeJudge0())
    task = await gen()
    c = task.contents
    assert c["language_id"] == 71 and c["grading_mode"] == "equal_weight"
    assert c["solution_code"] == "SOLUTION" and c["starter_code"] == "STARTER"
    visible = [t for t in c["test_cases"] if not t["hidden"]]
    hidden = [t for t in c["test_cases"] if t["hidden"]]
    assert len(visible) == 2 and len(hidden) == 3
    assert all(t["id"].startswith("tc_") and t["weight"] == 1 for t in c["test_cases"])
    assert task.description.startswith("Read a word")


async def test_report_records_what_was_verified(patch_env):
    patch_env(FakeModel([make_draft()]), FakeJudge0())
    report = (await gen()).contents["ai_validation"]
    assert report["validated"] is True
    assert report["tests_total"] == 5 and report["tests_visible"] == 2 and report["tests_hidden"] == 3
    assert report["reference_passed"] == 5
    assert report["deterministic"] is True and report["samples_agree"] is True
    assert report["mutants_tried"] == 2 and report["mutants_killed"] == 2
    assert report["attempts"] == 1 and report["warnings"] == []
    assert report["judge0_runs"] == 15  # reference twice + starter, 5 tests each


async def test_surviving_wrong_solution_is_reported_not_fatal(patch_env):
    # MUTANT1 behaves exactly like the solution, so the tests cannot catch it.
    judge0 = FakeJudge0({"MUTANT1": lambda s, n: run(str(len(s)))})
    patch_env(FakeModel([make_draft()]), judge0)
    report = (await gen()).contents["ai_validation"]
    assert report["mutants_tried"] == 2 and report["mutants_killed"] == 1
    assert report["warnings"], "a surviving wrong solution must produce a warning"


# --- failures and repair ------------------------------------------------------

async def test_reference_failure_is_repaired_with_feedback(patch_env):
    bad = make_draft(solution_code="SOLUTION_BAD")
    good = make_draft()
    judge0 = FakeJudge0({
        "SOLUTION_BAD": lambda s, n: run("", status=6, desc="Compilation Error", compile_output="syntax error"),
    })
    model = FakeModel([bad, good])
    patch_env(model, judge0)
    task = await gen()
    assert task.contents["ai_validation"]["attempts"] == 2
    # the second request told the model what went wrong
    assert "failed on test 1" in model.prompts[1] and "Compilation Error" in model.prompts[1]


async def test_task_is_dropped_when_repairs_run_out(patch_env):
    bad = lambda: make_draft(solution_code="SOLUTION_BAD")  # noqa: E731
    judge0 = FakeJudge0({"SOLUTION_BAD": lambda s, n: run("", status=11, desc="Runtime Error (NZEC)")})
    patch_env(FakeModel([bad(), bad(), bad()]), judge0)
    with pytest.raises(cg.CodeTaskDropped):
        await gen()


async def test_starter_that_already_passes_is_rejected(patch_env):
    cheating = make_draft(starter_code="STARTER_FULL")
    good = make_draft()
    judge0 = FakeJudge0({"STARTER_FULL": lambda s, n: run(str(len(s)))})
    model = FakeModel([cheating, good])
    patch_env(model, judge0)
    task = await gen()
    assert task.contents["starter_code"] == "STARTER"
    assert "starter code already passes" in model.prompts[1]


async def test_nondeterministic_reference_is_rejected(patch_env):
    flaky = make_draft(solution_code="SOLUTION_FLAKY")
    judge0 = FakeJudge0({"SOLUTION_FLAKY": lambda s, n: run(str(len(s) + n))})
    patch_env(FakeModel([flaky, flaky, flaky]), judge0)
    with pytest.raises(cg.CodeTaskDropped, match="different output"):
        await gen()


async def test_sample_output_must_match_the_reference(patch_env):
    draft = make_draft()
    draft.tests[0].expected_stdout = "7"  # reference prints 2
    fixed = make_draft()
    model = FakeModel([draft, fixed])
    patch_env(model, FakeJudge0())
    task = await gen()
    assert task.contents["ai_validation"]["attempts"] == 2
    assert "Sample test 1" in model.prompts[1]


async def test_empty_reference_output_is_rejected(patch_env):
    silent = make_draft(solution_code="SOLUTION_SILENT")
    judge0 = FakeJudge0({"SOLUTION_SILENT": lambda s, n: run("")})
    patch_env(FakeModel([silent, silent, silent]), judge0)
    with pytest.raises(cg.CodeTaskDropped, match="printed nothing"):
        await gen()


# --- shape rules (no Judge0 needed) -------------------------------------------

def test_shape_requires_enough_and_distinct_tests():
    few = make_draft(tests=make_draft().tests[:3])
    assert any("between 5 and 12" in i for i in cg._shape_issues(few))

    dup = make_draft()
    dup.tests[3].stdin = dup.tests[2].stdin
    assert any("repeats the input" in i for i in cg._shape_issues(dup))


def test_shape_requires_two_samples_and_two_hidden():
    tests = [
        AICodeTestInput(label=f"t{i}", stdin=str(i), kind="sample", expected_stdout=str(i))
        for i in range(5)
    ]
    # five samples: only 3 can be visible, so 2 stay hidden -> fine
    assert cg._shape_issues(make_draft(tests=tests)) == []

    one_sample = [
        AICodeTestInput(label="s", stdin="0", kind="sample", expected_stdout="1"),
        *[AICodeTestInput(label=f"t{i}", stdin=str(i + 1), kind="typical") for i in range(5)],
    ]
    assert any("at least 2 tests of kind 'sample'" in i for i in cg._shape_issues(make_draft(tests=one_sample)))


def test_shape_rejects_oversized_input():
    d = make_draft()
    d.tests[4].stdin = "x" * (cg.MAX_STDIN_CHARS + 1)
    assert any("longer than" in i for i in cg._shape_issues(d))


def test_at_most_three_tests_are_visible():
    tests = [
        AICodeTestInput(label=f"s{i}", stdin=str(i), kind="sample", expected_stdout=str(i))
        for i in range(5)
    ]
    assert cg._visibility(make_draft(tests=tests)) == [True, True, True, False, False]


# --- configuration ------------------------------------------------------------

async def test_unsupported_language_is_refused():
    with pytest.raises(ValueError):
        await cg.generate_code_task(model_name="m", language_id=1, difficulty="easy", prompt="x")


def test_supported_languages_are_python_js_java_cpp():
    assert sorted(cg.supported_language_ids()) == [54, 62, 63, 71]


# --- students never receive the validation report ------------------------------

def test_ai_validation_is_stripped_from_student_payloads():
    from src.services.courses.activities.assignments import _strip_answer_key

    contents = {
        "language_id": 71, "starter_code": "x", "solution_code": "secret",
        "test_cases": [{"id": "a", "stdin": "1", "expectedStdout": "2", "hidden": True}],
        "ai_validation": {"model": "m", "warnings": []},
    }
    for keep in (False, True):
        out = _strip_answer_key(contents, keep_answer_keys=keep)
        assert "ai_validation" not in out and "solution_code" not in out
    assert "ai_validation" in contents  # the stored contents are untouched


# --- jobs ----------------------------------------------------------------------

async def test_job_collects_tasks_dropped_and_refunds(monkeypatch):
    refunds = []
    monkeypatch.setattr(jobs, "refund_ai_credit", lambda org_id, amount: refunds.append((org_id, amount)))
    outcomes = iter(["ok", "drop", "ok"])

    async def fake_generate(*, progress, **kw):
        await progress("draft", "Writing")
        kind = next(outcomes)
        if kind == "drop":
            raise cg.CodeTaskDropped("reference failed")
        return GeneratedTask(title="t", description="d", assignment_type="CODE", contents={}, max_grade_value=100)

    monkeypatch.setattr(jobs, "generate_code_task", fake_generate)
    job = jobs.start_job(user_id=7, org_id=3, num_tasks=3, generation_kwargs={})
    for _ in range(100):
        if job.status in ("done", "failed"):
            break
        await asyncio.sleep(0.01)
    assert job.status == "done"
    assert len(job.tasks) == 2 and [d["task_index"] for d in job.dropped] == [1]
    assert refunds == [(3, jobs.CREDIT_COST_PER_TASK)]  # only the dropped task is refunded
    assert jobs.get_job(job.job_id) is job


async def test_job_fails_cleanly_when_judge0_is_down(monkeypatch):
    refunds = []
    monkeypatch.setattr(jobs, "refund_ai_credit", lambda org_id, amount: refunds.append((org_id, amount)))

    async def broken(*, progress, **kw):
        raise Judge0Error("unreachable")

    monkeypatch.setattr(jobs, "generate_code_task", broken)
    job = jobs.start_job(user_id=8, org_id=3, num_tasks=2, generation_kwargs={})
    for _ in range(100):
        if job.status in ("done", "failed"):
            break
        await asyncio.sleep(0.01)
    assert job.status == "failed" and "not available" in job.error
    assert refunds == [(3, 2 * jobs.CREDIT_COST_PER_TASK)]


async def test_user_cannot_run_two_jobs_at_once(monkeypatch):
    gate = asyncio.Event()

    async def slow(*, progress, **kw):
        await gate.wait()
        return GeneratedTask(title="t", description="d", assignment_type="CODE", contents={}, max_grade_value=100)

    monkeypatch.setattr(jobs, "generate_code_task", slow)
    monkeypatch.setattr(jobs, "refund_ai_credit", lambda *a, **k: None)
    job = jobs.start_job(user_id=99, org_id=1, num_tasks=1, generation_kwargs={})
    await asyncio.sleep(0.01)
    assert jobs.user_has_active_job(99) is True
    assert jobs.user_has_active_job(100) is False
    gate.set()
    for _ in range(100):
        if job.status == "done":
            break
        await asyncio.sleep(0.01)
    assert jobs.user_has_active_job(99) is False
