-- Runs once, on the first start of the ClickHouse container (empty data directory).
-- Same table the platform expects from its analytics backend; events older than a year expire.
CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.events
(
    event_name String,
    timestamp  DateTime,
    org_id     Int64,
    user_id    Int64,
    session_id String,
    properties String,
    source     String,
    ip         String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (org_id, event_name, timestamp)
TTL timestamp + toIntervalDay(365);
