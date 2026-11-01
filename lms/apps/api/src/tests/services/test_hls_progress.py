"""Tests for HLS progress reporting (ffmpeg -progress parsing, reporter wiring)."""

import asyncio

import pytest

import src.services.utils.hls_jobs as hls_jobs
import src.services.utils.hls_transcode as ht


def test_read_progress_fraction_uses_last_out_time(tmp_path):
    f = tmp_path / "p"
    f.write_bytes(b"frame=1\nout_time_us=1000000\nprogress=continue\nframe=2\nout_time_us=30000000\nprogress=continue\n")
    assert ht._read_progress_fraction(str(f), 60.0) == pytest.approx(0.5)


def test_read_progress_fraction_clamps_and_handles_missing(tmp_path):
    f = tmp_path / "p"
    f.write_bytes(b"out_time_us=90000000\n")
    assert ht._read_progress_fraction(str(f), 60.0) == 1.0
    assert ht._read_progress_fraction(str(f), 0) is None
    assert ht._read_progress_fraction(str(tmp_path / "nope"), 60.0) is None
    f.write_bytes(b"progress=continue\n")
    assert ht._read_progress_fraction(str(f), 60.0) is None


async def test_watch_progress_reports_changes_only(tmp_path, monkeypatch):
    monkeypatch.setattr(ht, "PROGRESS_POLL_SECONDS", 0.01)
    f = tmp_path / "p"
    f.write_bytes(b"out_time_us=6000000\n")  # 10% of 60 s
    seen = []

    async def reporter(pct):
        seen.append(pct)

    task = asyncio.create_task(ht._watch_progress(str(f), 60.0, reporter))
    await asyncio.sleep(0.1)
    f.write_bytes(b"out_time_us=30000000\n")  # 50%
    await asyncio.sleep(0.1)
    task.cancel()
    assert seen == [10, 50]


async def test_watch_progress_survives_reporter_errors(tmp_path, monkeypatch):
    monkeypatch.setattr(ht, "PROGRESS_POLL_SECONDS", 0.01)
    f = tmp_path / "p"
    f.write_bytes(b"out_time_us=6000000\n")
    calls = []

    async def reporter(pct):
        calls.append(pct)
        raise RuntimeError("db down")

    task = asyncio.create_task(ht._watch_progress(str(f), 60.0, reporter))
    await asyncio.sleep(0.05)
    assert not task.done()
    task.cancel()
    assert calls == [10]


async def test_transcode_activity_sets_reporter_and_start_time(monkeypatch):
    statuses, progress = [], []

    async def fake_transcode(src, out):
        reporter = ht.progress_reporter.get()
        assert reporter is not None
        await reporter(40)
        return {"master": "master.m3u8", "renditions": ["720p"], "thumbnails": None}

    async def _resolve(uuid):
        return {"org_uuid": "O", "course_uuid": "C", "filename": "v.mp4"}

    async def _set(uuid, status, **extra):
        statuses.append((status, extra))

    async def _prog(uuid, percent, elapsed, eta):
        progress.append((percent, eta))

    monkeypatch.setattr(hls_jobs, "_resolve_source", _resolve)
    monkeypatch.setattr(hls_jobs, "_fetch_source", lambda s, d: True)
    monkeypatch.setattr(hls_jobs, "transcode_source_to_hls", fake_transcode)
    monkeypatch.setattr(hls_jobs, "is_s3_enabled", lambda: True)
    monkeypatch.setattr(hls_jobs, "upload_directory_to_s3_parallel", lambda out, prefix, **k: True)
    monkeypatch.setattr(hls_jobs, "_set_status", _set)
    monkeypatch.setattr(hls_jobs, "_set_progress", _prog)

    assert await hls_jobs.transcode_activity("act") is True
    assert statuses[0][0] == "processing" and "started_at" in statuses[0][1]
    assert progress and progress[0][0] == 40
    assert ht.progress_reporter.get() is None  # reset after the job
