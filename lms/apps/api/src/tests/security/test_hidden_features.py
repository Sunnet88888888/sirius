"""SIRIUS_HIDDEN_FEATURES: platform-level switch that hides whole features."""

import pytest
from fastapi import HTTPException

from src.security.features_utils.hidden import (
    hidden_features,
    is_feature_hidden,
    require_feature_visible,
)
from src.security.features_utils.resolve import resolve_all_features, resolve_feature


def test_nothing_is_hidden_by_default(monkeypatch):
    monkeypatch.delenv("SIRIUS_HIDDEN_FEATURES", raising=False)
    assert hidden_features() == frozenset()
    assert not is_feature_hidden("boards")


def test_list_is_parsed_with_spaces_and_case(monkeypatch):
    monkeypatch.setenv("SIRIUS_HIDDEN_FEATURES", " Boards , playgrounds ,, ")
    assert hidden_features() == frozenset({"boards", "playgrounds"})
    assert is_feature_hidden("BOARDS")
    assert not is_feature_hidden("podcasts")


def test_hidden_feature_resolves_disabled_but_not_plan_locked(monkeypatch):
    monkeypatch.setenv("SIRIUS_HIDDEN_FEATURES", "boards,playgrounds")
    for feature in ("boards", "playgrounds"):
        resolved = resolve_feature(feature, {})
        assert resolved["enabled"] is False
        # available stays True so the UI shows no upgrade prompt
        assert resolved["available"] is True
        assert resolved["hidden"] is True


def test_other_features_are_untouched(monkeypatch):
    monkeypatch.setenv("SIRIUS_HIDDEN_FEATURES", "boards,playgrounds")
    resolved = resolve_all_features({})
    assert resolved["boards"]["hidden"] is True
    assert resolved["playgrounds"]["hidden"] is True
    assert "hidden" not in resolved["courses"]


@pytest.mark.asyncio
async def test_route_dependency_answers_404_when_hidden(monkeypatch):
    monkeypatch.setenv("SIRIUS_HIDDEN_FEATURES", "boards")
    with pytest.raises(HTTPException) as exc:
        await require_feature_visible("boards")()
    assert exc.value.status_code == 404
    # a feature that is not hidden passes
    assert await require_feature_visible("podcasts")() is None
