"""Validation of formatted lesson comments.

A formatted comment is a Tiptap/ProseMirror JSON document. The server never
trusts what the browser sends: it rebuilds the document from a whitelist of
node types, marks and attributes (anything else is rejected), and derives the
plain text used for the length limit, the empty check and notification
snippets. The page draws the stored JSON as React elements, so no HTML coming
from users is ever inserted into a page.
"""

import json
import re
from typing import Any

from fastapi import HTTPException

COMMENT_FORMAT_TEXT = "text"
COMMENT_FORMAT_TIPTAP = "tiptap"
COMMENT_FORMATS = (COMMENT_FORMAT_TEXT, COMMENT_FORMAT_TIPTAP)

MAX_DEPTH = 8
MAX_NODES = 2000
MAX_JSON_BYTES = 30_000
MAX_LINK_LENGTH = 2000

_BLOCKS = {"paragraph", "bulletList", "orderedList", "codeBlock"}
_LIST_ITEM_CHILDREN = {"paragraph", "bulletList", "orderedList", "codeBlock"}
_INLINE = {"text", "hardBreak"}
_MARKS = {"bold", "italic", "code", "link"}
_LANGUAGE_RE = re.compile(r"^[A-Za-z0-9_+#.\-]{1,30}$")
_LINK_RE = re.compile(r"^(https?://|mailto:)[^\s<>\"'\x00-\x1f]+$", re.IGNORECASE)


def _bad(detail: str = "Invalid formatted comment") -> HTTPException:
    return HTTPException(status_code=422, detail=detail)


class _Walker:
    def __init__(self) -> None:
        self.nodes = 0
        self.text_parts: list[str] = []

    def mark(self, raw: Any) -> dict:
        if not isinstance(raw, dict) or raw.get("type") not in _MARKS:
            raise _bad()
        kind = raw["type"]
        if kind != "link":
            return {"type": kind}
        attrs = raw.get("attrs")
        href = attrs.get("href") if isinstance(attrs, dict) else None
        if not isinstance(href, str) or len(href) > MAX_LINK_LENGTH or not _LINK_RE.match(href.strip()):
            raise _bad("Links must start with http://, https:// or mailto:")
        return {"type": "link", "attrs": {"href": href.strip()}}

    def text(self, raw: dict) -> dict:
        value = raw.get("text")
        if not isinstance(value, str) or value == "":
            raise _bad()
        marks_raw = raw.get("marks") or []
        if not isinstance(marks_raw, list) or len(marks_raw) > len(_MARKS):
            raise _bad()
        marks = [self.mark(m) for m in marks_raw]
        if len({m["type"] for m in marks}) != len(marks):
            raise _bad()
        self.text_parts.append(value)
        node: dict = {"type": "text", "text": value}
        if marks:
            node["marks"] = marks
        return node

    def children(self, raw: dict, allowed: set[str], depth: int, in_code: bool = False) -> list[dict]:
        items = raw.get("content") or []
        if not isinstance(items, list):
            raise _bad()
        return [self.node(i, allowed, depth + 1, in_code) for i in items]

    def node(self, raw: Any, allowed: set[str], depth: int, in_code: bool = False) -> dict:
        self.nodes += 1
        if self.nodes > MAX_NODES or depth > MAX_DEPTH:
            raise _bad("Formatted comment is too complex")
        if not isinstance(raw, dict) or raw.get("type") not in allowed:
            raise _bad()
        kind = raw["type"]
        if kind == "text":
            node = self.text(raw)
            if in_code and node.get("marks"):
                raise _bad()
            return node
        if kind == "hardBreak":
            self.text_parts.append("\n")
            return {"type": "hardBreak"}
        if kind == "paragraph":
            out: dict = {"type": "paragraph"}
            content = self.children(raw, _INLINE, depth)
            if content:
                out["content"] = content
            self.text_parts.append("\n")
            return out
        if kind == "codeBlock":
            out = {"type": "codeBlock"}
            attrs = raw.get("attrs")
            lang = attrs.get("language") if isinstance(attrs, dict) else None
            if lang is not None:
                if not isinstance(lang, str) or not _LANGUAGE_RE.match(lang):
                    raise _bad()
                out["attrs"] = {"language": lang}
            content = self.children(raw, {"text"}, depth, in_code=True)
            if content:
                out["content"] = content
            self.text_parts.append("\n")
            return out
        if kind in ("bulletList", "orderedList"):
            out = {"type": kind}
            if kind == "orderedList":
                attrs = raw.get("attrs")
                start = attrs.get("start") if isinstance(attrs, dict) else None
                if start is not None:
                    if isinstance(start, bool) or not isinstance(start, int) or not 1 <= start <= 9999:
                        raise _bad()
                    out["attrs"] = {"start": start}
            content = self.children(raw, {"listItem"}, depth)
            if not content:
                raise _bad()
            out["content"] = content
            return out
        if kind == "listItem":
            content = self.children(raw, _LIST_ITEM_CHILDREN, depth)
            if not content:
                raise _bad()
            return {"type": "listItem", "content": content}
        raise _bad()  # pragma: no cover (every allowed type is handled above)


def clean_tiptap_comment(raw: str) -> tuple[str, str]:
    """Return (canonical JSON text, plain text) for a formatted comment, or
    raise HTTP 422. The plain text is what the length limit is applied to."""
    if not isinstance(raw, str) or len(raw.encode("utf-8")) > MAX_JSON_BYTES:
        raise _bad("Formatted comment is too large")
    try:
        doc = json.loads(raw)
    except (ValueError, RecursionError):
        raise _bad()
    if not isinstance(doc, dict) or doc.get("type") != "doc":
        raise _bad()
    walker = _Walker()
    try:
        content = walker.children(doc, _BLOCKS, 0)
    except RecursionError:
        raise _bad("Formatted comment is too complex")
    plain = "".join(walker.text_parts).strip()
    canonical = json.dumps({"type": "doc", "content": content}, ensure_ascii=False, separators=(",", ":"))
    return canonical, plain
