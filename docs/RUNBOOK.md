# Runbook

## Status
- `docker compose ps` in the platform stack directory and in the Judge0 stack directory.
- Health: `GET /api/v1/health` returns 200.

## Logs
`docker compose logs --tail 200 app` (platform), `... workers` / `... server` (Judge0).

## Deploy a new build
Run the deploy script on the server (see `docs/WORKLOG.md` for the current procedure). It builds the image from `lms/`, tags it with the git short hash, restarts the app and waits for the health check.

## Roll back
Set the previous image tag in the stack's compose file and run `docker compose up -d app`. Previous tags are kept on the server.

## Judge0 checks
- Without the client headers the API must return 401.
- A trivial Python submission must return `Accepted`.
- An infinite loop must return `Time Limit Exceeded`.

## Backup
Database dump (`pg_dump`) plus the content volume. Do this before any schema-affecting deploy.
