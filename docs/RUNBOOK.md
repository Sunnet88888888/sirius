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

## Analytics (ClickHouse)
- Status: `docker compose ps` shows `clickhouse` and `analytics-proxy` healthy.
- Row count: `docker compose exec clickhouse clickhouse-client --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" --query "SELECT count(), max(timestamp) FROM analytics.events"`.
- Back up before risky changes: dump `analytics.events` as shown in `deploy/analytics/README.md`; the volume is `clickhouse_data`.
- If the dashboard shows "not configured": the three `LEARNHOUSE_TINYBIRD_*` variables are missing from `.env`, or the app container was not recreated after adding them.


## HTTPS (Caddy)
- Site: https://berdinov.com (www redirects to it). Caddy (`caddy` service, `/opt/learnhouse/Caddyfile`) holds the certificates in the `caddy_data` volume and renews them itself.
- The app container is published only on 127.0.0.1:8081; `deploy.sh` checks health there.
- Check: `docker compose logs --tail 50 caddy`. Certificates need ports 80 and 443 open and the DNS A records in place.

## Disk cleanup on deploy
After a healthy deploy, `deploy.sh` keeps the 4 newest `sirius-lms` images (current + 3 for rollback), removes older ones and prunes Docker build cache older than 7 days. Rolling back to a removed tag means rebuilding it.
