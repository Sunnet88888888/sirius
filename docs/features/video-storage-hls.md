# Video storage and HLS

## What it does
Uploaded files live in an S3-compatible bucket (Selectel, bucket `berdinov`, region `ru-7`). Hosted videos are transcoded to HLS (adaptive quality: up to 1080p, 720p, 480p, 360p, capped at the source resolution), encrypted with AES-128, with a hover-preview sprite. Students' browsers download video segments straight from the bucket; the server only checks permission and hands out short-lived signed links.

## How it works
- Settings (in `.env`, listed in `deploy/stack/env.example`): `LEARNHOUSE_CONTENT_DELIVERY_TYPE=s3api`, bucket, endpoint, region, `LEARNHOUSE_S3_API_ADDRESSING_STYLE=virtual`, the access keys, and `LEARNHOUSE_HLS_ENABLED=true`.
- Upload: the API stores the source file in the bucket and puts a job on a Redis queue. A background consumer inside the app process runs ffmpeg (installed in the image), uploads the result and records `hls.status` (`processing`, `ready`, `failed`) on the activity.
- Playback: `/api/v1/stream/hls/...` checks access, returns the playlist with segment URLs signed for the bucket; `/stream/video/...` redirects to a signed link for plain MP4. Generic `/content/...` files (images, PDFs) are still proxied through the API.
- Bucket CORS: allowed origin `https://berdinov.com`, methods GET and HEAD, headers `*`, exposed `Content-Length, Content-Range, Accept-Ranges, ETag`. Selectel answers CORS only on bucket sub-domain URLs, which is why the addressing style is `virtual`.
- The bucket is private; anonymous requests get 403.

## Capacity (measured 2026-11-01 on the 4-CPU server)
- 30 s 720p test clip: transcoded in 20 s.
- 120 s 1080p clip (4 renditions): 126 s, about real time; 2.5 to 3.7 CPU cores busy, about 0.5 GB extra RAM; the site stayed responsive (27 ms).
- Consequence: a 60-minute 1080p lecture takes about an hour. One job is capped at 40 minutes (`JOB_TIMEOUT_SECONDS` in `hls_jobs.py`), so long videos would fail and be retried until the retry limit. Move transcoding to its own worker server (planned) or raise the cap before uploading long lectures.
- Concurrency is 1; uploads wait in the queue.

## Moving the transcoder to its own server (planned, not built)
Run the same image with ffmpeg on another host with access to the same Redis, Postgres and bucket (over a private tunnel, never open ports), and stop the in-app consumer on the main server. Needs a small code addition: a flag to disable the consumer on the main server and a worker entry point that runs only the consumer.

## Processing status for authors and admins
In the course structure editor (Dashboard > course > Content) each hosted video shows its processing state next to the title:
- **In queue**, **Processing 42% · about 6 min left** (with a small progress bar), **Ready**, **Not processed** (file without a video track), or **Processing failed: <reason>** with a **Retry** button.
- The badge refreshes itself every 10 seconds while a video is queued or processing. The video already plays in the original quality (MP4) meanwhile.
- Anyone who can edit the course (authors, admins) sees it and can retry; the retry endpoint is `POST /api/v1/activities/video/{activity_uuid}/hls/retry` (update rights on the course; 409 while the video is queued or processing).
- Data: `activity.extra_metadata.hls` now carries `queued_at`, `started_at`, `progress` (0-99), `elapsed_seconds`, `eta_seconds`; progress comes from ffmpeg's `-progress` output polled every 5 seconds. Failed jobs keep the `error` code (`source_unavailable`, `transcode_failed`, `upload_failed`, `timeout`, `exception`).
- Texts are in `locales/*.json` under `dashboard.courses.structure.activity.video_processing` (English, Russian, Turkmen; other languages fall back to English). The Turkmen wording is a machine draft and needs a native review.
- Video blocks inside lessons are not covered yet; only hosted video activities.
- A deploy restarts the app and restarts any running transcode from the beginning.
