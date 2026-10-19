"""Tests for src/services/code/judge0_client.py (pure helpers)."""

import base64

import pytest

from src.services.code import judge0_client as j0


def b64(text: str) -> str:
    return base64.b64encode(text.encode()).decode()


def test_results_are_decoded_from_base64():
    r = j0._to_result({
        "status": {"id": 6, "description": "Compilation Error"},
        "stdout": None,
        "stderr": None,
        "compile_output": b64("error: expected ‘;’ before ‘}’ token"),  # curly quotes
        "time": "0.004",
        "memory": 1024,
    })
    assert r.status_id == 6 and not r.ok
    assert "‘;’" in r.compile_output and r.stdout == "" and r.time == 0.004


def test_accepted_result():
    r = j0._to_result({"status": {"id": 3, "description": "Accepted"}, "stdout": b64("42\n")})
    assert r.ok and r.stdout == "42\n"


def test_bad_base64_does_not_raise():
    assert j0._unb64("%%%not base64%%%") == ""
    assert j0._unb64(None) == ""


def test_normalize_matches_the_student_grader_rule():
    assert j0.normalize_output("x\n") == j0.normalize_output("x")
    assert j0.normalize_output("a  \nb\t\n\n\n") == "a\nb"
    assert j0.normalize_output("  indented\n") == "  indented"
    assert j0.normalize_output(None) == ""


def test_not_configured_raises(monkeypatch):
    class Cfg:
        judge0_config = None

    monkeypatch.setattr(j0, "get_learnhouse_config", lambda: Cfg())
    assert j0.is_configured() is False
    with pytest.raises(j0.Judge0Error):
        j0._config()
