# Hiding features (Boards and Playgrounds)

## What it does
The platform can hide whole features without removing any code or data. Right now **Boards** and **Playgrounds** are hidden:
- They disappear from the dashboard menus (left menu, mobile menu, the "more" list), the public menu, the library picker and the home overview.
- Their pages show the standard "not available" card, with no upgrade prompt.
- Their API routes answer 404.
- Existing boards and playgrounds stay in the database, untouched.

## How it works
- Setting: environment variable `SIRIUS_HIDDEN_FEATURES`, a comma-separated list of feature keys. On the server it is set in `/opt/learnhouse/.env` to `boards,playgrounds`.
- Backend: `security/features_utils/hidden.py`. `resolve_feature` returns `enabled: false, available: true, hidden: true` for a hidden feature, so every place that already reads the resolved features hides it. `router.py` adds `require_feature_visible(...)` to the boards and playgrounds routers.
- Web: the left menu's "more" list skips features marked `hidden`.
- Tests: `apps/api/src/tests/security/test_hidden_features.py`.

## Turn a feature back on
Remove the key from `SIRIUS_HIDDEN_FEATURES` in `/opt/learnhouse/.env` (empty value shows everything), then recreate the app container: `cd /opt/learnhouse && docker compose up -d learnhouse-app`.

## Not covered
Search results can still list a playground if one exists in the database (there are none today).
