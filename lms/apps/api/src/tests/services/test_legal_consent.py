from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from src.db.users import UserCreate
from src.services.users.legal_consent import apply_legal_consent, check_legal_version, legal_consent_required


@pytest.fixture
def require(monkeypatch):
    monkeypatch.setenv("LEARNHOUSE_REQUIRE_LEGAL_CONSENT", "true")


@pytest.fixture
def optional(monkeypatch):
    monkeypatch.delenv("LEARNHOUSE_REQUIRE_LEGAL_CONSENT", raising=False)


class TestRequiredFlag:
    def test_off_by_default(self, optional):
        assert legal_consent_required() is False

    @pytest.mark.parametrize("v", ["1", "true", "TRUE", "yes"])
    def test_on(self, monkeypatch, v):
        monkeypatch.setenv("LEARNHOUSE_REQUIRE_LEGAL_CONSENT", v)
        assert legal_consent_required() is True


class TestCheck:
    def test_valid_version_kept(self, optional):
        assert check_legal_version("2026-11-03", enforce=True) == "2026-11-03"

    def test_blank_is_none_when_not_required(self, optional):
        assert check_legal_version("  ", enforce=True) is None
        assert check_legal_version(None, enforce=True) is None

    @pytest.mark.parametrize("bad", ["2026-1-3", "latest", "2026-11-03; drop", "20261103", "2026-11-03x"])
    def test_malformed_rejected_even_when_optional(self, optional, bad):
        with pytest.raises(HTTPException) as e:
            check_legal_version(bad, enforce=False)
        assert e.value.status_code == 422

    def test_missing_refused_when_required(self, require):
        with pytest.raises(HTTPException) as e:
            check_legal_version(None, enforce=True)
        assert e.value.status_code == 422 and e.value.detail["code"] == "LEGAL_CONSENT_REQUIRED"

    def test_missing_allowed_when_not_enforced(self, require):
        assert check_legal_version(None, enforce=False) is None


class TestApply:
    def test_stamps_version_and_time(self, optional):
        user = SimpleNamespace(legal_consent_version=None, legal_consent_at=None)
        apply_legal_consent(user, "2026-11-03", enforce=True)
        assert user.legal_consent_version == "2026-11-03"
        assert user.legal_consent_at and "T" in user.legal_consent_at

    def test_leaves_user_untouched_without_version(self, optional):
        user = SimpleNamespace(legal_consent_version=None, legal_consent_at=None)
        apply_legal_consent(user, None, enforce=False)
        assert user.legal_consent_version is None and user.legal_consent_at is None


class TestSchema:
    def test_usercreate_accepts_version(self):
        u = UserCreate(username="abcd", email="a@b.co", password="x", legal_version="2026-11-03")
        assert u.legal_version == "2026-11-03"

    def test_usercreate_without_version(self):
        assert UserCreate(username="abcd", email="a@b.co", password="x").legal_version is None

    def test_usercreate_rejects_overlong(self):
        with pytest.raises(Exception):
            UserCreate(username="abcd", email="a@b.co", password="x", legal_version="x" * 17)
