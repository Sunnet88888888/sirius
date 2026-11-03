from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from src.db.courses.courses import CourseCreate, CourseUpdate, normalize_language
from src.services.courses.cache import get_cached_courses_list, set_cached_courses_list


class TestNormalizeLanguage:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            (None, None),
            ("", None),
            ("   ", None),
            ("ru", "ru"),
            ("RU", "ru"),
            (" en ", "en"),
            ("pt-BR", "pt-BR"),
            ("pt_BR", "pt-BR"),
            ("tk", "tk"),
        ],
    )
    def test_accepts(self, raw, expected):
        assert normalize_language(raw) == expected

    @pytest.mark.parametrize("raw", ["r", "russian", "ru-", "ru--x", "12", "ru en", "ru;drop", "en-" + "x" * 9])
    def test_rejects(self, raw):
        with pytest.raises(ValueError):
            normalize_language(raw)


class TestSchemas:
    def test_create_normalizes(self):
        c = CourseCreate(name="n", public=True, open_to_contributors=False, language="EN")
        assert c.language == "en"

    def test_create_default_is_any_language(self):
        c = CourseCreate(name="n", public=True, open_to_contributors=False)
        assert c.language is None

    def test_create_rejects_bad_code(self):
        with pytest.raises(ValidationError):
            CourseCreate(name="n", public=True, open_to_contributors=False, language="klingon")

    def test_update_empty_string_kept_to_clear(self):
        assert CourseUpdate(language="").language == ""
        assert CourseUpdate(language="  ").language == ""

    def test_update_not_sent_stays_none(self):
        assert CourseUpdate().language is None

    def test_update_rejects_bad_code(self):
        with pytest.raises(ValidationError):
            CourseUpdate(language="xx_yy_zz")


class TestCacheKeysPerLanguage:
    def test_keys_differ_by_language(self):
        redis_client = Mock()
        with patch("src.services.courses.cache.get_redis_client", return_value=redis_client):
            set_cached_courses_list("org", 1, 10, [{"id": 1}])
            set_cached_courses_list("org", 1, 10, [{"id": 2}], "ru")
            set_cached_courses_list("org", 1, 10, [{"id": 3}], "en")
        keys = [c.args[0] for c in redis_client.setex.call_args_list]
        assert keys == [
            "courses_cache:list:org:1:10",
            "courses_cache:list:org:1:10:ru",
            "courses_cache:list:org:1:10:en",
        ]

    def test_get_reads_language_key(self):
        redis_client = Mock()
        redis_client.get.return_value = None
        with patch("src.services.courses.cache.get_redis_client", return_value=redis_client):
            get_cached_courses_list("org", 2, 5, "ru")
        redis_client.get.assert_called_once_with("courses_cache:list:org:2:5:ru")
