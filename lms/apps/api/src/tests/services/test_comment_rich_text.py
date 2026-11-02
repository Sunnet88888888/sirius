"""Tests for formatted lesson comments (Tiptap JSON validation)."""

import json

import pytest
from fastapi import HTTPException

from src.db.activity_comments import MAX_COMMENT_LENGTH
from src.services.courses.activities.comment_rich_text import (
    MAX_DEPTH,
    clean_tiptap_comment,
)
from src.services.courses.activities.comments import _clean_content


def doc(*blocks):
    return json.dumps({"type": "doc", "content": list(blocks)})


def p(*inline):
    return {"type": "paragraph", "content": list(inline)}


def t(text, *marks):
    node = {"type": "text", "text": text}
    if marks:
        node["marks"] = list(marks)
    return node


def rejects(raw):
    with pytest.raises(HTTPException) as e:
        clean_tiptap_comment(raw)
    assert e.value.status_code == 422


def test_accepts_all_allowed_formatting_and_returns_plain_text():
    raw = doc(
        p(t("Hello ", {"type": "bold"}), t("world", {"type": "italic"}, {"type": "bold"}), {"type": "hardBreak"}, t("x", {"type": "code"})),
        p(t("see ", {"type": "link", "attrs": {"href": "https://example.com/a?b=1"}})),
        {"type": "bulletList", "content": [{"type": "listItem", "content": [p(t("one"))]}]},
        {"type": "orderedList", "attrs": {"start": 3}, "content": [{"type": "listItem", "content": [p(t("two"))]}]},
        {"type": "codeBlock", "attrs": {"language": "python"}, "content": [t("print(1)")]},
    )
    canonical, plain = clean_tiptap_comment(raw)
    assert json.loads(canonical)["type"] == "doc"
    assert "Hello world" in plain and "print(1)" in plain and "two" in plain


def test_rebuilds_document_and_drops_unknown_attributes():
    raw = doc({"type": "paragraph", "attrs": {"style": "color:red"}, "content": [t("hi")]})
    canonical, _ = clean_tiptap_comment(raw)
    assert json.loads(canonical) == {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "hi"}]}]}


@pytest.mark.parametrize(
    "href",
    ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<b>x</b>", "//evil.example", "/relative", "https://a b", "https://x\">", ""],
)
def test_rejects_bad_links(href):
    rejects(doc(p(t("x", {"type": "link", "attrs": {"href": href}}))))


@pytest.mark.parametrize("href", ["http://example.com", "https://example.com/x#y", "mailto:a@example.com"])
def test_accepts_safe_links(href):
    clean_tiptap_comment(doc(p(t("x", {"type": "link", "attrs": {"href": href}}))))


def test_rejects_unknown_nodes_and_marks():
    rejects(doc({"type": "heading", "attrs": {"level": 1}, "content": [t("x")]}))
    rejects(doc({"type": "image", "attrs": {"src": "https://x/y.png"}}))
    rejects(doc(p(t("x", {"type": "underline"}))))
    rejects(doc(p({"type": "script"})))


def test_rejects_malformed_documents():
    rejects("not json")
    rejects("[]")
    rejects(json.dumps({"type": "paragraph"}))
    rejects(json.dumps({"type": "doc", "content": "x"}))
    rejects(doc(p({"type": "text", "text": ""})))
    rejects(doc(p({"type": "text", "text": 5})))
    rejects(doc({"type": "bulletList", "content": []}))
    rejects(doc({"type": "orderedList", "attrs": {"start": True}, "content": [{"type": "listItem", "content": [p(t("a"))]}]}))
    rejects(doc({"type": "codeBlock", "attrs": {"language": "py thon<"}, "content": [t("x")]}))
    rejects(doc({"type": "codeBlock", "content": [t("x", {"type": "bold"})]}))
    rejects(doc(p(t("x", {"type": "bold"}, {"type": "bold"}))))


def test_rejects_too_deep_and_too_large():
    node = {"type": "listItem", "content": [p(t("x"))]}
    for _ in range(MAX_DEPTH + 2):
        node = {"type": "listItem", "content": [{"type": "bulletList", "content": [node]}]}
    rejects(doc({"type": "bulletList", "content": [node]}))
    rejects(doc(p(t("x" * 40_000))))
    deep = "[" * 100_000
    rejects(deep)


def test_clean_content_text_format_unchanged():
    assert _clean_content("  hi  ") == ("hi", "text", "hi")
    with pytest.raises(HTTPException):
        _clean_content("   ")
    with pytest.raises(HTTPException):
        _clean_content("x" * (MAX_COMMENT_LENGTH + 1))
    assert _clean_content("x" * MAX_COMMENT_LENGTH)[2] == "x" * MAX_COMMENT_LENGTH


def test_clean_content_tiptap_limits_visible_text_not_markup():
    ok = doc(p(t("a" * MAX_COMMENT_LENGTH, {"type": "bold"})))
    content, fmt, plain = _clean_content(ok, "tiptap")
    assert fmt == "tiptap" and len(plain) == MAX_COMMENT_LENGTH
    with pytest.raises(HTTPException) as e:
        _clean_content(doc(p(t("a" * (MAX_COMMENT_LENGTH + 1)))), "tiptap")
    assert e.value.status_code == 422
    with pytest.raises(HTTPException):
        _clean_content(doc(p()), "tiptap")  # empty comment
    with pytest.raises(HTTPException):
        _clean_content("hi", "html")  # unknown format
