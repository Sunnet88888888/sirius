"""Tests for LEARNHOUSE_S3_API_ADDRESSING_STYLE in storage_utils."""

import pytest

import src.services.courses.transfer.storage_utils as storage_utils


@pytest.mark.parametrize(
    "value, expected",
    [
        (None, {}),
        ("", {}),
        ("auto", {}),
        ("bogus", {}),
        ("virtual", {"s3": {"addressing_style": "virtual"}}),
        (" Path ", {"s3": {"addressing_style": "path"}}),
    ],
)
def test_addressing_config(monkeypatch, value, expected):
    if value is None:
        monkeypatch.delenv("LEARNHOUSE_S3_API_ADDRESSING_STYLE", raising=False)
    else:
        monkeypatch.setenv("LEARNHOUSE_S3_API_ADDRESSING_STYLE", value)
    assert storage_utils._addressing_config() == expected


def test_virtual_style_presigns_on_bucket_subdomain(monkeypatch):
    import boto3
    import botocore.config

    monkeypatch.setenv("LEARNHOUSE_S3_API_ADDRESSING_STYLE", "virtual")
    cfg = botocore.config.Config(signature_version="s3v4", **storage_utils._addressing_config())
    client = boto3.client(
        "s3",
        endpoint_url="https://s3.example.test",
        region_name="ru-7",
        aws_access_key_id="k",
        aws_secret_access_key="s",
        config=cfg,
    )
    url = client.generate_presigned_url("get_object", Params={"Bucket": "bkt", "Key": "a/b.ts"}, ExpiresIn=60)
    assert url.startswith("https://bkt.s3.example.test/a/b.ts?")
