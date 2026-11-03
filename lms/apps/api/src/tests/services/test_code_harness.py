"""Hidden test harness for CODE tasks: helpers, student payload stripping, run endpoint and grading."""
import base64
import io
import zipfile
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from src.routers import code_execution
from src.services.code.harness import apply_harness, harness_of, validate_harness
from src.services.courses.activities import assignments as assignments_service
from src.services.courses.activities.assignments import _strip_answer_key

HARNESS = {
    "suffix": "print('RESULT')",
    "files": [{"name": "db.py", "content": "VALUE = 1"}],
}


def contents(**extra):
    base = {
        "language_id": 71,
        "starter_code": "pass",
        "test_cases": [
            {"id": "a", "label": "visible", "stdin": "one", "expectedStdout": "OK", "hidden": False},
            {"id": "b", "label": "hidden", "stdin": "two", "expectedStdout": "OK", "hidden": True},
        ],
        "harness": HARNESS,
    }
    base.update(extra)
    return base


class TestHelpers:
    def test_no_harness(self):
        assert harness_of({}) is None
        assert harness_of({"harness": {}}) is None
        assert harness_of({"harness": "x"}) is None
        assert harness_of(None) is None
        assert apply_harness({}, "code") == ("code", None)

    def test_suffix_and_files(self):
        src, files = apply_harness(contents(), "def f(): pass")
        assert src == "def f(): pass\nprint('RESULT')"
        assert files == [{"name": "db.py", "content": "VALUE = 1"}]

    def test_prefix_is_placed_first(self):
        src, _ = apply_harness({"harness": {"prefix": "import os", "suffix": "print(1)"}}, "x = 1")
        assert src.splitlines() == ["import os", "x = 1", "print(1)"]

    @pytest.mark.parametrize("name", ["../x.py", "a/b.py", ".hidden", "a\\b"])
    def test_unsafe_file_names_are_dropped(self, name):
        _, files = apply_harness({"harness": {"suffix": "x", "files": [{"name": name, "content": "c"}]}}, "s")
        assert files is None

    def test_validate(self):
        assert validate_harness(None) is None
        assert validate_harness(HARNESS) is None
        assert validate_harness("x")
        assert validate_harness({"suffix": 5})
        assert validate_harness({"suffix": "x" * (64 * 1024 + 1)})
        assert validate_harness({"files": "nope"})
        assert validate_harness({"files": [{"name": "../x", "content": "c"}]})
        assert validate_harness({"files": [{"name": "a.py", "content": 1}]})
        assert validate_harness({"files": [{"name": f"f{i}.py", "content": ""} for i in range(11)]})


class TestStudentPayload:
    @pytest.mark.parametrize("keep", [False, True])
    def test_harness_never_reaches_a_student(self, keep):
        stripped = _strip_answer_key(contents(), keep_answer_keys=keep)
        assert "harness" not in stripped
        # the hidden test's data is stripped as before
        hidden = [t for t in stripped["test_cases"] if t["id"] == "b"][0]
        assert "stdin" not in hidden and "expectedStdout" not in hidden

    def test_original_is_untouched(self):
        c = contents()
        _strip_answer_key(c)
        assert "harness" in c


@pytest.fixture
def run(monkeypatch):
    """Drive execute_batch with Judge0 and the task lookup mocked."""
    submit = AsyncMock(return_value={"status": {"id": 3}, "stdout": "OK\n"})
    monkeypatch.setattr(code_execution, "_get_judge0_config", lambda: object())
    monkeypatch.setattr(code_execution, "check_rate_limit", lambda **_: (True, 1, 60))
    monkeypatch.setattr(code_execution, "_submit_single", submit)

    async def go(task_contents, is_instructor, **body_overrides):
        load = AsyncMock(return_value=(task_contents, is_instructor))
        monkeypatch.setattr(assignments_service, "load_code_task_for_run", load)
        payload = dict(
            language_id=999,
            source_code="student()",
            assignment_task_uuid="assignmenttask_x",
            test_cases=[{"id": "client", "label": "from the browser", "stdin": "x", "expected_stdout": "WRONG"}],
        )
        payload.update(body_overrides)
        body = code_execution.ExecuteBatchRequest(**payload)
        res = await code_execution.execute_batch(request=None, body=body, current_user=SimpleNamespace(id=1), db_session=None)
        return res, submit

    return go


class TestRunEndpoint:
    async def test_student_runs_visible_tests_only_with_the_harness(self, run):
        res, submit = await run(contents(), is_instructor=False)
        assert [r["id"] for r in res["results"]] == ["a"]          # hidden test is not run, client's own test ignored
        assert all(r["passed"] for r in res["results"])
        args = submit.call_args.args
        assert args[1] == 71                                        # the task's language, not the one sent
        assert args[2] == "student()\nprint('RESULT')"              # harness wrapped around the student's code
        assert args[3] == "one"                                     # stdin of the stored test case
        zf = zipfile.ZipFile(io.BytesIO(base64.b64decode(args[4])))
        assert zf.read("db.py") == b"VALUE = 1"

    async def test_instructor_runs_every_test(self, run):
        res, _ = await run(contents(), is_instructor=True)
        assert [r["id"] for r in res["results"]] == ["a", "b"]

    async def test_client_additional_files_do_not_apply(self, run):
        _, submit = await run(
            contents(), is_instructor=False,
            additional_files=[{"name": "evil.py", "content": "boom"}],
        )
        zf = zipfile.ZipFile(io.BytesIO(base64.b64decode(submit.call_args.args[4])))
        assert zf.namelist() == ["db.py"]

    async def test_task_without_harness_keeps_the_old_behaviour(self, run):
        plain = contents()
        del plain["harness"]
        res, submit = await run(plain, is_instructor=False)
        assert [r["id"] for r in res["results"]] == ["client"]      # the browser's test cases
        assert submit.call_args.args[1] == 999 and submit.call_args.args[2] == "student()"


class TestGrading:
    async def test_grading_applies_the_harness(self, monkeypatch):
        submit = AsyncMock(return_value={"status": {"id": 3}, "stdout": "OK"})
        monkeypatch.setattr("src.routers.code_execution._get_judge0_config", lambda: object())
        monkeypatch.setattr("src.routers.code_execution._submit_single", submit)
        task = SimpleNamespace(contents=contents(), max_grade_value=100, assignment_task_uuid="t")
        grade = await assignments_service._grade_code_task_async(
            task, SimpleNamespace(task_submission={"source_code": "student()", "language_id": 4242})
        )
        assert grade == 100
        assert submit.await_count == 2                              # the visible and the hidden test
        for call in submit.await_args_list:
            assert call.args[1] == 71                               # language forced to the task's
            assert call.args[2] == "student()\nprint('RESULT')"
            assert call.args[4] is not None                         # additional files zip
        assert sorted(c.args[3] for c in submit.await_args_list) == ["one", "two"]
