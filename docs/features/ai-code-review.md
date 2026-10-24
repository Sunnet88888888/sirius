# AI code review

## What it does
In a CODE task, a student can press **Review my code**. An AI mentor reads the statement, the student's code and the results of the visible tests, and returns: a short summary, scores (correctness, readability, efficiency, style; 1-5), a list of remarks with line numbers, up to three tips and, only when all visible tests pass, a short improved version of the weakest part. It is advice only and never changes the grade. Teachers see a student's reviews in the grading view of the task.

## What the model is and is not given
- Given: task title, statement and hint, the code (numbered lines), results of the tests the student can run (pass/fail, expected/actual, errors).
- Never given: the reference solution and the hidden tests. While a visible test fails the review points toward the cause with a hint and returns no fix (also enforced in code, not only in the prompt).
- The student's code is wrapped as data; the prompt tells the model to ignore instructions found in it.

## Limits (per student) and how to change them
Read from the environment on every request, set in `/opt/learnhouse/.env`:

| Variable | Default | Meaning |
|---|---|---|
| `LEARNHOUSE_AI_REVIEW_DAILY_LIMIT` | 10 | reviews per UTC day, `0` = no limit |
| `LEARNHOUSE_AI_REVIEW_MONTHLY_LIMIT` | 300 | reviews per UTC month, `0` = no limit |
| `LEARNHOUSE_AI_REVIEW_TIER` | standard | model tier: `fast`, `standard` or `pro` |

Apply a change with `cd /opt/learnhouse && docker compose up -d learnhouse-app` (recreates the container, no rebuild).

Usage is the number of rows in `aicodereview`; a row is written only for a delivered review, so a failed model call costs the student nothing. One review at a time per student. The organisation's AI credits are **not** spent (the per-student limits replace them); the org still needs the AI feature enabled, and the existing per-user AI rate limit applies.

## API
- `POST /ai/code-review` (student): body `assignment_task_uuid`, `source_code`, `results[]`, `locale`. 429 with detail `daily_review_limit_reached` / `monthly_review_limit_reached` / `review_in_progress`.
- `GET /ai/code-review/history?assignment_task_uuid=`: my last 5 reviews of the task + my quota.
- `GET /ai/code-review/grading?assignment_task_uuid=&user_id=`: a student's reviews (course editors).

## Files
`apps/api/src/services/ai/code_review.py` (prompt, limits), `src/routers/ai/code_review.py`, `src/db/ai_code_reviews.py`, migration `b8c9d0e1f2a3`; web: `AICodeReviewCard.tsx`, `services/ai/codeReview.ts`, mounted in `TaskCodeObject.tsx` (student and grading views).

## Rollback
Redeploy the previous image (`deploy.sh --rollback <sha>`). The `aicodereview` table can stay.
