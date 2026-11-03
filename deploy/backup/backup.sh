#!/usr/bin/env bash
# Nightly encrypted backup of the SIRIUS stack to an S3 bucket.
#   - Postgres (pg_dump, custom format), the configuration files and, on Sundays, the ClickHouse events
#   - every file is encrypted with the PUBLIC key in $CONF/gnupg before it leaves the server; the private key is not on this machine
#   - the bucket credentials live in $CONF/backup.env (see backup.env.example)
# On failure it logs and, when a Resend key is present in the stack .env, emails BACKUP_ALERT_EMAIL.
set -euo pipefail

STACK="${STACK_DIR:-/opt/learnhouse}"
CONF="${BACKUP_CONF_DIR:-$STACK/backup}"
# shellcheck disable=SC1091
set -a; . "$CONF/backup.env"; set +a
: "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}" "${AWS_ACCESS_KEY_ID:?}" "${AWS_SECRET_ACCESS_KEY:?}"

RECIPIENT="${BACKUP_GPG_RECIPIENT:-sirius-backup}"
PG_USER="${BACKUP_PG_USER:-learnhouse}"
PG_DB="${BACKUP_PG_DB:-learnhouse}"
STAMP="$(date +%Y-%m-%d)"
PREFIX="daily/${STAMP}"
WORK="$(mktemp -d /var/backups/sirius-work.XXXXXX)"
chmod 700 "$WORK"

env_value() { grep -E "^$1=" "$STACK/.env" | head -1 | cut -d= -f2-; }

alert() {
  local msg="$1" key to
  echo "BACKUP FAILED: $msg" >&2
  key="$(env_value LEARNHOUSE_RESEND_API_KEY || true)"; to="${BACKUP_ALERT_EMAIL:-}"
  if [ -n "$key" ] && [ -n "$to" ]; then
    curl -s -m 20 -X POST https://api.resend.com/emails -H "Authorization: Bearer $key" -H 'Content-Type: application/json' \
      -d "{\"from\":\"SIRIUS <$(env_value LEARNHOUSE_SYSTEM_EMAIL_ADDRESS)>\",\"to\":[\"$to\"],\"subject\":\"Backup FAILED on $(hostname)\",\"html\":\"<p>${msg}</p><p>Log: journalctl -u sirius-backup</p>\"}" >/dev/null || true
  fi
}
cleanup() { rm -rf "$WORK"; }
on_error() { alert "step failed near line $1"; cleanup; exit 1; }
trap 'on_error $LINENO' ERR
trap cleanup EXIT

aws_cli() {
  docker run --rm -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION \
    -e AWS_REQUEST_CHECKSUM_CALCULATION -e AWS_RESPONSE_CHECKSUM_VALIDATION -v "$WORK:/w" \
    -v /etc/ssl/certs/ca-certificates.crt:/ca.crt:ro -e AWS_CA_BUNDLE=/ca.crt \
    amazon/aws-cli --endpoint-url "$BACKUP_S3_ENDPOINT" "$@"
}
encrypt() { # encrypt <in> <out>
  gpg --homedir "$CONF/gnupg" --batch --yes --trust-model always --recipient "$RECIPIENT" --output "$2" --encrypt "$1"
}

cd "$STACK"
echo "== $(date -Is) backup start ($PREFIX)"

# 1. Postgres
docker compose exec -T db pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > "$WORK/postgres.dump"
[ -s "$WORK/postgres.dump" ]
USERS="$(docker compose exec -T db psql -U "$PG_USER" -d "$PG_DB" -Atc 'select count(*) from "user"' | tr -d '\r')"
COURSES="$(docker compose exec -T db psql -U "$PG_USER" -d "$PG_DB" -Atc 'select count(*) from course' | tr -d '\r')"
encrypt "$WORK/postgres.dump" "$WORK/postgres.dump.gpg"; rm -f "$WORK/postgres.dump"

# 2. Configuration (compose files, .env with every secret, Caddyfile, deploy script, analytics and Judge0 settings)
FILES=()
for f in "$STACK/.env" "$STACK/docker-compose.yml" "$STACK/Caddyfile" "$STACK/deploy.sh" "$STACK/analytics" \
         /opt/judge0/judge0.conf /opt/judge0/docker-compose.yml; do
  [ -e "$f" ] && FILES+=("${f#/}")
done
tar czf "$WORK/config.tar.gz" -C / "${FILES[@]}"
encrypt "$WORK/config.tar.gz" "$WORK/config.tar.gz.gpg"; rm -f "$WORK/config.tar.gz"

# 3. ClickHouse events, on Sundays (or BACKUP_FORCE_CLICKHOUSE=1)
if [ "$(date +%u)" = 7 ] || [ "${BACKUP_FORCE_CLICKHOUSE:-0}" = 1 ]; then
  docker compose exec -T clickhouse clickhouse-client --user "$(env_value CLICKHOUSE_USER)" --password "$(env_value CLICKHOUSE_PASSWORD)" \
    --query "SELECT * FROM analytics.events FORMAT Native" | gzip > "$WORK/clickhouse-events.native.gz"
  encrypt "$WORK/clickhouse-events.native.gz" "$WORK/clickhouse-events.native.gz.gpg"; rm -f "$WORK/clickhouse-events.native.gz"
fi

# 4. Manifest (not secret: sizes, row counts, image) and checksums of the encrypted files
{
  echo "date: $(date -Is)"; echo "host: $(hostname)"
  echo "image: $(docker inspect -f '{{.Config.Image}}' learnhouse-learnhouse-app-1 2>/dev/null || echo unknown)"
  echo "rows: users=$USERS courses=$COURSES"
} > "$WORK/MANIFEST.txt"
( cd "$WORK" && sha256sum ./*.gpg >> MANIFEST.txt; ls -l ./*.gpg | awk '{print "size:", $5, $9}' >> MANIFEST.txt )

# 5. Upload and verify the sizes in the bucket
aws_cli s3 cp /w "s3://$BACKUP_S3_BUCKET/$PREFIX/" --recursive --only-show-errors
REMOTE="$(aws_cli s3 ls "s3://$BACKUP_S3_BUCKET/$PREFIX/" | awk '{print $3, $4}' | sort)"
LOCAL="$(cd "$WORK" && ls -l | awk 'NR>1{print $5, $9}' | sort)"
[ "$REMOTE" = "$LOCAL" ] || { echo "local: $LOCAL"; echo "remote: $REMOTE"; false; }

# 6. Retention: remove day folders older than BACKUP_KEEP_DAYS (default 35), including old versions and delete markers
#    (the bucket is versioned, so a plain delete would only hide them). Never fails the backup.
KEEP_DAYS="${BACKUP_KEEP_DAYS:-35}"
if [ "${BACKUP_PRUNE:-1}" = 1 ]; then
  CUTOFF="$(date -d "-$KEEP_DAYS days" +%Y-%m-%d)"
  for d in $(aws_cli s3 ls "s3://$BACKUP_S3_BUCKET/daily/" | awk '/PRE/{print $2}' | tr -d '/'); do
    [[ "$d" < "$CUTOFF" ]] || continue
    aws_cli s3api list-object-versions --bucket "$BACKUP_S3_BUCKET" --prefix "daily/$d/" --output json \
      --query '{Objects: [].concat(Versions||`[]`, DeleteMarkers||`[]`)[].{Key: Key, VersionId: VersionId}, Quiet: `true`}' > "$WORK/del.json" || continue
    if grep -q '"Key"' "$WORK/del.json"; then
      aws_cli s3api delete-objects --bucket "$BACKUP_S3_BUCKET" --delete file:///w/del.json >/dev/null \
        && echo "pruned daily/$d" || echo "WARNING: could not prune daily/$d"
    fi
  done
  rm -f "$WORK/del.json"
fi

date +%s > "$CONF/last-success"
echo "== $(date -Is) backup ok: users=$USERS courses=$COURSES"
