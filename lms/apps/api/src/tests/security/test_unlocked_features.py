from unittest.mock import patch

import pytest
from fastapi import HTTPException

from src.security.features_utils.plan_check import _check_mode_bypass
from src.security.features_utils.unlocked import is_feature_unlocked, unlocked_features


class TestUnlockedFeatures:
    def test_nothing_unlocked_by_default(self, monkeypatch):
        monkeypatch.delenv("SIRIUS_UNLOCKED_FEATURES", raising=False)
        assert unlocked_features() == frozenset()
        assert is_feature_unlocked("analytics_advanced") is False

    def test_parses_comma_separated_list(self, monkeypatch):
        monkeypatch.setenv("SIRIUS_UNLOCKED_FEATURES", " Analytics_Advanced , ,scorm ")
        assert unlocked_features() == frozenset({"analytics_advanced", "scorm"})
        assert is_feature_unlocked("ANALYTICS_ADVANCED") is True
        assert is_feature_unlocked("sso") is False


class TestModeBypassWithUnlock:
    def test_oss_blocks_enterprise_only_feature_by_default(self, monkeypatch):
        monkeypatch.delenv("SIRIUS_UNLOCKED_FEATURES", raising=False)
        with patch("src.security.features_utils.plan_check.get_deployment_mode", return_value="oss"):
            with pytest.raises(HTTPException) as exc:
                _check_mode_bypass("analytics_advanced")
        assert exc.value.status_code == 403

    def test_oss_allows_unlocked_feature(self, monkeypatch):
        monkeypatch.setenv("SIRIUS_UNLOCKED_FEATURES", "analytics_advanced")
        with patch("src.security.features_utils.plan_check.get_deployment_mode", return_value="oss"):
            assert _check_mode_bypass("analytics_advanced") is True

    def test_unlocking_one_feature_leaves_the_others_blocked(self, monkeypatch):
        monkeypatch.setenv("SIRIUS_UNLOCKED_FEATURES", "analytics_advanced")
        with patch("src.security.features_utils.plan_check.get_deployment_mode", return_value="oss"):
            with pytest.raises(HTTPException) as exc:
                _check_mode_bypass("sso")
        assert exc.value.status_code == 403

    def test_saas_mode_ignores_the_switch(self, monkeypatch):
        monkeypatch.setenv("SIRIUS_UNLOCKED_FEATURES", "analytics_advanced")
        with patch("src.security.features_utils.plan_check.get_deployment_mode", return_value="saas"):
            assert _check_mode_bypass("analytics_advanced") is None


class TestAnalyticsStatusAdvancedFlag:
    def test_flag_follows_the_switch(self, monkeypatch):
        from src.routers.analytics import _advanced_unlocked

        with patch("src.security.features_utils.plan_check.get_deployment_mode", return_value="oss"):
            monkeypatch.delenv("SIRIUS_UNLOCKED_FEATURES", raising=False)
            assert _advanced_unlocked() is False
            monkeypatch.setenv("SIRIUS_UNLOCKED_FEATURES", "analytics_advanced")
            assert _advanced_unlocked() is True
