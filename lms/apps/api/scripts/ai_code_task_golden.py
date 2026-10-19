"""Measure the AI code-task generator against real Judge0 and the real model.

Run inside the API container (it needs the model key and Judge0 credentials from
the normal environment):

    cd /app/api && .venv/bin/python scripts/ai_code_task_golden.py [--only N]

It generates one task per prompt in the golden set, prints the outcome of each
(accepted or dropped, attempts, tests, wrong solutions caught, seconds) and a
summary with the drop rate. Nothing is saved to the database. The run spends
model credits on the configured provider.
"""

import argparse
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.services.ai.code_task_gen import CodeTaskDropped, generate_code_task  # noqa: E402
from src.services.ai.llm import model_for_tier  # noqa: E402

# (language id, difficulty, teacher request)
GOLDEN = [
    (71, "easy", "Sum of two integers read from one line."),
    (71, "easy", "Count how many vowels a word contains."),
    (71, "medium", "Print the numbers of a list in ascending order without duplicates."),
    (71, "medium", "Check whether a string is a palindrome, ignoring case and spaces."),
    (63, "easy", "Print the largest of three numbers."),
    (63, "medium", "Count how often each word occurs and print the words alphabetically with their counts."),
    (54, "easy", "Print the factorial of n (n up to 12)."),
    (54, "medium", "Find the second largest distinct number in a list."),
    (62, "easy", "Print the sum of the digits of a number."),
    (62, "medium", "Reverse the order of the words in a sentence."),
]


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", type=int, default=0, help="run only the first N prompts")
    args = parser.parse_args()
    cases = GOLDEN[: args.only] if args.only else GOLDEN
    model = model_for_tier("pro")
    print(f"model: {model}; prompts: {len(cases)}\n")

    accepted = 0
    attempts_total = 0
    started_all = time.time()
    for i, (language_id, difficulty, prompt) in enumerate(cases, 1):
        started = time.time()
        try:
            task = await generate_code_task(
                model_name=model, language_id=language_id, difficulty=difficulty, prompt=prompt
            )
            r = task.contents["ai_validation"]
            accepted += 1
            attempts_total += r["attempts"]
            print(
                f"{i:2d}. OK   lang={language_id} {difficulty:6s} attempts={r['attempts']} "
                f"tests={r['tests_total']} (visible {r['tests_visible']}) "
                f"wrong-solutions-caught={r['mutants_killed']}/{r['mutants_tried']} "
                f"judge0-runs={r['judge0_runs']} {time.time() - started:.0f}s  | {task.title}"
            )
            for w in r["warnings"]:
                print(f"      warning: {w}")
        except CodeTaskDropped as exc:
            print(f"{i:2d}. DROP lang={language_id} {difficulty:6s} {time.time() - started:.0f}s  | {exc}")
        except Exception as exc:  # network, quota, Judge0 down
            print(f"{i:2d}. ERROR lang={language_id} {difficulty:6s} {type(exc).__name__}: {exc}")

    total = len(cases)
    print(
        f"\naccepted {accepted}/{total} ({100 * accepted // total}%), dropped {total - accepted}; "
        f"mean attempts of accepted: {attempts_total / accepted if accepted else 0:.2f}; "
        f"total {time.time() - started_all:.0f}s"
    )


if __name__ == "__main__":
    asyncio.run(main())
