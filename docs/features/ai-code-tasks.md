# AI-generated code tasks (verified with Judge0)

## What it does
In an assignment's editor, "Generate tasks with AI" now offers a **Code (verified)** task type next to quiz, form, short answer, number and file upload. The teacher picks the language (Python 3, JavaScript, Java, C++), the difficulty and how many code tasks (1-3). The preview shows each task with what was verified, plus the starter code, the reference solution (teachers only) and every test. "Add to assignment" saves them like any other task. Nothing is saved before that.

## How a task is made (and why the tests can be trusted)
1. A model (the strongest configured tier) writes: the statement, a starter skeleton, a reference solution, and the test **inputs**. It does not provide the expected outputs of the hidden tests.
2. The reference solution is run in Judge0 on every test input. **The expected output of each test is that real output.**
3. The task is accepted only if all of this holds:
   - 5 to 12 tests, at least 2 visible and 2 hidden, no repeated input, inputs under 2,000 characters;
   - the reference solution runs cleanly on every test and prints something;
   - running it twice gives identical output;
   - the example outputs the model wrote for the statement agree with the real output;
   - the starter code does **not** already pass every test.
4. A failed check is sent back to the model for up to 2 repair rounds. A task that still fails is dropped and the teacher is told; credits for dropped tasks are refunded.
5. As an extra signal the model writes 2 plausible wrong solutions; the report shows how many the tests catch. A wrong solution that passes every test is a warning, not a failure.

Generated code only ever runs inside Judge0 (network off, CPU, memory and time limits). Nothing generated runs on the LMS server.

## What the teacher sees and what students never see
- Badges: reference passes N/N, output reproducible, examples match, starter does not solve it, wrong solutions caught k/n, and warnings.
- The reference solution and the validation report (`ai_validation`) are removed from every student payload by the same function that already hides solutions and hidden tests.
- Students get the new split-view code workspace; the statement is the task description.

## Files
- `apps/api/src/services/ai/code_task_gen.py`: prompts, validation, repair loop.
- `apps/api/src/services/ai/code_task_jobs.py`: background jobs (start, poll, refunds, limits).
- `apps/api/src/services/code/judge0_client.py`: small Judge0 client (base64, so compiler messages with non-UTF-8 characters work).
- `apps/api/src/routers/ai/assignment_gen.py`: `POST /ai/assignments/code-task/generate`, `GET /ai/assignments/code-task/jobs/{id}`.
- `apps/web/.../Modals/GenerateTasksAIModal.tsx`: the teacher UI.
- `apps/api/scripts/ai_code_task_golden.py`: runs 10 sample prompts and prints the accept/drop rate (spends model credits).
- Tests: `src/tests/services/test_ai_code_task_gen.py`, `test_code_judge0_client.py`.

## Limits and safeguards
- One generation at a time per teacher; at most 2 run at once on the server so student submissions keep their share of Judge0.
- 4 credits per requested code task, refunded for tasks that are dropped or if Judge0 is down.
- Job state is in the API process's memory (kept 1 hour). Restarting the API loses a running job.
- Requires the same rights as generating other tasks: author access to the course.

## What it does not guarantee
A statement can be clear and self-consistent and still be a weak exercise. The checks prove that the answer key matches a working solution, not that the exercise is good. Teachers should read the statement and the tests before publishing.

## Rollback
Remove "Code (verified)" by redeploying the previous image (`deploy.sh --rollback <sha>`). Tasks already saved are ordinary code tasks and keep working. No database changes.
