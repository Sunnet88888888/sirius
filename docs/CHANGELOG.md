# Changelog

## Unreleased
- Video processing status for authors and admins in the course editor: queue, progress with time left, ready, failure reason and a Retry button. See `features/video-storage-hls.md`.
- Uploads and video now use Selectel S3 storage; videos are transcoded to encrypted adaptive HLS on the main server and streamed to students straight from the bucket. New option `LEARNHOUSE_S3_API_ADDRESSING_STYLE`, ffmpeg added to the image, HTTPS through Caddy on berdinov.com, deploy.sh prunes old images. See `features/video-storage-hls.md` and `deploy/README.md`.
- Analytics in the admin dashboard now works: our own ClickHouse stores the events (`deploy/analytics/`), and the Advanced tab is open through `SIRIUS_UNLOCKED_FEATURES`. See `features/analytics.md`.
- AI code review for students in code tasks (advice only, 10 per day / 300 per month per student, configurable in `.env`). See `features/ai-code-review.md`.
- Initial import of the platform source into this repository.
- Dark theme for the whole app, with a toggle (header, login page, dashboard user menu). Default stays light.
- Student code tasks open in a split workspace: description and examples left, editor right, test results below the editor.
- Turkmen interface language (all strings). Machine-drafted; needs review by a native speaker.
- Boards and Playgrounds are hidden through `SIRIUS_HIDDEN_FEATURES` (code and data kept).
- AI can generate code tasks (Python, JavaScript, Java, C++). Each task is verified in Judge0: the expected outputs are the real output of a reference solution.
