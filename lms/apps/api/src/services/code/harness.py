"""Hidden test harness for CODE assignment tasks.

Some tasks cannot be checked by comparing a program's output with an expected text: a FastAPI route, a Pydantic
model or an SQLAlchemy query has to be *called* by test code. A task may therefore carry a harness in its
``contents``:

    "harness": {
        "suffix": "<python appended after the student's code; reads the test name from stdin and prints the result>",
        "prefix": "<optional code placed before the student's code>",
        "files":  [{"name": "db.py", "content": "..."}],     # helper modules written next to the script
        "embed":  true                                       # optional: pass the student's code as the string `__student_source__`
    }

The harness is stored on the server only. It is removed from every student payload (see ``_strip_answer_key``) and is
applied both when a student presses "Run tests" and when the submission is graded, so the visible and the hidden tests
run exactly the same code. A student's program runs in the same process as the harness and could in principle read it;
this is a learning platform, not an exam proctor.
"""
from typing import Optional

MAX_HARNESS_CHARS = 64 * 1024
MAX_HARNESS_FILES = 10


def harness_of(contents) -> Optional[dict]:
    """Return the task's harness when it has something to run, else None."""
    if not isinstance(contents, dict):
        return None
    h = contents.get("harness")
    if not isinstance(h, dict):
        return None
    if not (h.get("suffix") or h.get("prefix") or h.get("files")):
        return None
    return h


def apply_harness(contents, source_code: str) -> tuple[str, Optional[list[dict]]]:
    """Wrap the student's source with the harness.

    Returns ``(final_source, files)``; ``files`` is a list of ``{"name", "content"}`` for Judge0's additional files, or
    None. Without a harness the source is returned unchanged.
    """
    h = harness_of(contents)
    if h is None:
        return source_code, None
    if h.get("embed"):
        # The student's code is not pasted into the program but handed over as the string `__student_source__`, so the
        # harness can compile it itself (top-level await, readable syntax errors, its own namespace).
        parts = [str(h.get("prefix") or ""), f"__student_source__ = {source_code!r}", str(h.get("suffix") or "")]
    else:
        parts = [str(h.get("prefix") or ""), source_code, str(h.get("suffix") or "")]
    final = "\n".join(p for p in parts if p != "")
    files = []
    for f in (h.get("files") or [])[:MAX_HARNESS_FILES]:
        if isinstance(f, dict) and f.get("name") and isinstance(f.get("content"), str):
            name = str(f["name"])
            # plain file names only: no paths, no hidden files
            if "/" in name or "\\" in name or name.startswith("."):
                continue
            files.append({"name": name, "content": f["content"]})
    return final, (files or None)


def validate_harness(h) -> Optional[str]:
    """Return an error message when ``h`` is not an acceptable harness, else None."""
    if h is None:
        return None
    if not isinstance(h, dict):
        return "harness must be an object"
    for key in ("prefix", "suffix"):
        v = h.get(key)
        if v is not None and (not isinstance(v, str) or len(v) > MAX_HARNESS_CHARS):
            return f"harness.{key} must be a string of at most {MAX_HARNESS_CHARS} characters"
    if h.get("embed") is not None and not isinstance(h.get("embed"), bool):
        return "harness.embed must be true or false"
    files = h.get("files")
    if files is not None:
        if not isinstance(files, list) or len(files) > MAX_HARNESS_FILES:
            return f"harness.files must be a list of at most {MAX_HARNESS_FILES} files"
        for f in files:
            if not isinstance(f, dict) or not isinstance(f.get("name"), str) or not isinstance(f.get("content"), str):
                return "each harness file needs a name and a content string"
            if "/" in f["name"] or "\\" in f["name"] or f["name"].startswith(".") or len(f["content"]) > MAX_HARNESS_CHARS:
                return "invalid harness file name or size"
    return None
