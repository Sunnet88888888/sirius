# Hidden test harness for code tasks

## What it is
Some programming tasks cannot be checked by comparing a program's printed output with an expected text: a FastAPI route, a Pydantic model or an SQLAlchemy query has to be called by test code. A CODE task can therefore carry a **harness**: Python code the server appends to the student's program (plus optional helper files), which runs the checks and prints the result.

## Data format
In the task's `contents` (stored on the server, never sent to students):
```
"harness": {
  "suffix": "<code appended after the student's code>",
  "prefix": "<optional code placed before it>",
  "files":  [{"name": "db.py", "content": "..."}]      # helper modules written next to the script
}
```
The test cases keep their normal meaning: `stdin` is the **scenario name** (the harness reads it with `sys.stdin.read()`), `expectedStdout` is what the harness prints when that scenario passes (for example `OK`), `hidden` hides a case from students as usual.

## Behaviour
- **Students never see it.** `_strip_answer_key` removes `harness` from every student payload, also in the "show correct answers" mode.
- **Run tests.** The editor sends the task id with `POST /code/execute-batch` (`assignment_task_uuid`). For a task with a harness the server loads the stored task, wraps the code, uses the task's own language and test cases (the visible ones for students, all for instructors) and ignores the test cases and files sent by the browser. Without a harness the old behaviour is unchanged.
- **Grading.** The server-side grader (`_grade_code_task_async`) applies the same harness, so visible and hidden tests run exactly the same code, and uses the task's language.
- **Authoring.** Set `harness` through the API (`POST/PUT /assignments/{uuid}/tasks`, validated: sizes, file names). The editor keeps the field when a teacher saves the task; it has no editor for it.
- Limits: 64 KB per part, 10 files, plain file names only.

## Limits and honesty
The student's program and the harness run in the same process. A determined student can read the harness source. This is a learning platform, not an exam proctor.

## Code
`apps/api/src/services/code/harness.py`, `routers/code_execution.py` (`execute_batch`), `services/courses/activities/assignments.py` (`load_code_task_for_run`, grading, `_strip_answer_key`), `apps/web/.../TaskEditor/Subs/TaskTypes/TaskCodeObject.tsx`. Tests: `apps/api/src/tests/services/test_code_harness.py`.

## Judge0 environment
Language id 71 now runs **Python 3.11** with FastAPI, Pydantic 2, SQLAlchemy 2.0, aiosqlite, httpx, Jinja2 and python-multipart. On the Judge0 host the interpreter lives in `/opt/python311` (python-build-standalone, `pip install` into it) and is mounted read-only at `/usr/local/python-3.11` in the server and worker containers; `/opt/judge0/languages-active.rb` (mounted over `/api/db/languages/active.rb`) points language 71 at it, because Judge0 re-seeds its language table on every start. See `deploy/judge0/remote/README.md`.
