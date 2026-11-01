# Analytics

## What it does
The admin dashboard (Dashboard > Analytics) shows how learners use the school: live users, daily active users, top courses, the enrollment funnel and event counts, per-course statistics, and an Advanced tab (course drop-off, cohort retention, time to completion, peak hours, content effectiveness, new vs returning, completion velocity, certification rate, organization growth, rating by completion and more). Data can be exported as CSV.

## How it works
- The application sends one event per action (page view, course view, activity view, search, time on activity, enrollment, completion, assignment submitted, sign-up, certificate, discussion post) to its analytics backend. Sending never blocks or breaks a request.
- The backend is our own ClickHouse database, in front of which a small proxy (nginx) accepts the two calls the application makes: store an event, and run a SQL query. The files are in `deploy/analytics/`; install steps and checks are in its `README.md`.
- The admin dashboard asks the API, which runs predefined queries and caches results in Redis.
- Analytics switches on by itself when the three variables `LEARNHOUSE_TINYBIRD_API_URL`, `..._INGEST_TOKEN`, `..._READ_TOKEN` are set. Without them the dashboard says analytics is not configured.

## Advanced tab
The open-source edition blocks the advanced queries (they are marked Enterprise-only). We unlock them with a platform switch, the counterpart of the one that hides features:
- Setting: `SIRIUS_UNLOCKED_FEATURES=analytics_advanced` in `.env` (comma-separated feature keys).
- Backend: `security/features_utils/unlocked.py`; `_check_mode_bypass` skips the Enterprise-only block for listed keys. Other Enterprise-only features (SSO, audit logs, payments, SCORM) stay blocked.
- API: `GET /analytics/status` returns `advanced_unlocked`, which the web page reads to open the Advanced tab.
- Tests: `apps/api/src/tests/security/test_unlocked_features.py`.

## Data
- Table `analytics.events`; events older than 365 days expire. History starts when analytics is switched on (no backfill).
- Events contain the user id and IP address; they stay on our server.

## Turn it off
Remove the three analytics variables (and `SIRIUS_UNLOCKED_FEATURES`) from `.env` and recreate the app container. The data volume `clickhouse_data` stays.
