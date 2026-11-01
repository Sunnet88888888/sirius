# Analytics backend (ClickHouse)

The admin dashboard needs a place to store and query usage events. Instead of a hosted service we run ClickHouse next to the platform. See `docs/features/analytics.md` for what it shows and how it works.

## Files
| File | Purpose |
|---|---|
| `compose.yml` | the `clickhouse` and `analytics-proxy` services and the `clickhouse_data` volume |
| `clickhouse-init.sql` | creates the `analytics.events` table on the first start |
| `clickhouse-config.xml` | caps memory and turns off ClickHouse's own log tables |
| `nginx.conf.template` | the proxy: checks the two tokens, maps the platform's two calls onto ClickHouse |

## Install on a server
1. Copy this folder to the stack directory as `analytics/` (next to `docker-compose.yml`).
2. Add to the stack's `.env` (generate every secret, for example `openssl rand -hex 24`):
   ```
   CLICKHOUSE_USER=sirius_analytics
   CLICKHOUSE_PASSWORD=<secret>
   LEARNHOUSE_TINYBIRD_API_URL=http://analytics-proxy:8080
   LEARNHOUSE_TINYBIRD_INGEST_TOKEN=<secret>
   LEARNHOUSE_TINYBIRD_READ_TOKEN=<secret>
   SIRIUS_UNLOCKED_FEATURES=analytics_advanced
   ```
   (The `TINYBIRD` names are what the application code reads; the values point at our own proxy.)
3. At the top of `docker-compose.yml` add:
   ```
   include:
     - analytics/compose.yml
   ```
4. `docker compose up -d` (this starts ClickHouse and the proxy, and recreates the app with the new variables).

## Check it
```
docker compose ps                                   # clickhouse and analytics-proxy healthy
docker compose exec analytics-proxy wget -qO- http://localhost:8080/healthz
docker compose exec clickhouse clickhouse-client --user "$CLICKHOUSE_USER" --password "$CLICKHOUSE_PASSWORD" \
  --query "SELECT count(), max(timestamp) FROM analytics.events"
```
In the admin dashboard, Analytics must stop saying it is not configured, and the Advanced tab must be open.

## Back up and restore
```
# backup
docker compose exec -T clickhouse clickhouse-client --user ... --password ... \
  --query "SELECT * FROM analytics.events FORMAT Native" > events.native
# restore into an empty table
docker compose exec -T clickhouse clickhouse-client --user ... --password ... \
  --query "INSERT INTO analytics.events FORMAT Native" < events.native
```

## Notes
- ClickHouse and the proxy publish no ports; only containers in the same compose network can reach them.
- Events older than 365 days are deleted automatically (TTL in `clickhouse-init.sql`).
- Memory is capped at about 30% of the server RAM (`clickhouse-config.xml`).
