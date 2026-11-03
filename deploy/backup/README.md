# Encrypted backups to S3

A systemd timer runs `backup.sh` every night at about 03:30 (server time). It writes to a bucket reserved for backups.

## What is backed up
| File in `daily/<date>/` | Content |
|---|---|
| `postgres.dump.gpg` | `pg_dump -Fc` of the platform database (users, courses, progress, comments) |
| `config.tar.gz.gpg` | `.env` (all secrets), compose files, Caddyfile, deploy.sh, analytics and Judge0 settings |
| `clickhouse-events.native.gz.gpg` | analytics events, Sundays only |
| `MANIFEST.txt` | date, image, user and course counts, sha256 and size of each file (not secret) |

Not included: uploaded files and videos (they already live in the media bucket; enable versioning there) and Redis (cache and queue only).

## Encryption and keys
Every file is encrypted with the PUBLIC key `sirius-backup` (GnuPG, RSA 4096) before upload. The server holds only the public key (`<stack>/backup/gnupg`). The private key and its passphrase are outside the server (on the owner's Mac: `server-secrets/backup-gpg/`). Keep a second copy of both in a password manager: without them the backups cannot be read.

## Retention
The script removes day folders older than `BACKUP_KEEP_DAYS` (default 35) together with their old versions. Selectel ignores S3 lifecycle rules set through the API; use the panel if you prefer rules there and set `BACKUP_PRUNE=0`.

## Install on a server
1. Create a private bucket (versioning on) and an access key limited to it.
2. Generate a key pair on a trusted machine (`gpg --quick-generate-key`, RSA 4096), import ONLY the public key into `<stack>/backup/gnupg` (`gpg --homedir <stack>/backup/gnupg --import pub.gpg`), keep the private key elsewhere.
3. Copy `backup.sh` to `<stack>/backup/` (chmod 700) and `backup.env.example` to `<stack>/backup/backup.env` (chmod 600, fill in).
4. Copy the two systemd units to `/etc/systemd/system/`, then `systemctl daemon-reload && systemctl enable --now sirius-backup.timer`.
5. Run once by hand: `<stack>/backup/backup.sh`, then do a restore test (below).

The uploader is the `amazon/aws-cli` Docker image; the host CA bundle is mounted into it, because the image's own list does not yet trust Selectel's GlobalSign R6 chain.

## Check
```
systemctl list-timers sirius-backup.timer       # next run
journalctl -u sirius-backup -n 30               # last run
cat <stack>/backup/last-success | xargs -I{} date -d @{}
```
A failed run emails `BACKUP_ALERT_EMAIL` through Resend (needs the Resend key in the stack `.env`).

## Restore
On the machine that will run the platform (stop the app first so nothing writes to the database):
```
# 1. fetch one day (aws-cli or any S3 client)
aws s3 cp s3://<backup-bucket>/daily/<date>/ ./restore --recursive --endpoint-url https://s3.ru-7.storage.selcloud.ru
cd restore && sha256sum -c <(grep -E '^[0-9a-f]{64}' MANIFEST.txt)

# 2. decrypt (asks for the passphrase)
gpg --import sirius-backup-secret.asc
gpg --output postgres.dump   --decrypt postgres.dump.gpg
gpg --output config.tar.gz   --decrypt config.tar.gz.gpg

# 3. configuration, then database
tar xzf config.tar.gz -C /                         # restores /opt/learnhouse and /opt/judge0 files
cd /opt/learnhouse && docker compose up -d db
docker compose exec -T db pg_restore -U learnhouse -d learnhouse --clean --if-exists --no-owner < /path/to/restore/postgres.dump
docker compose up -d
```
ClickHouse: `gpg -d clickhouse-events.native.gz.gpg | gunzip | docker compose exec -T clickhouse clickhouse-client --user ... --password ... -q "INSERT INTO analytics.events FORMAT Native"`.

## Restore test (done 2026-11-03)
The first backup was downloaded, checked against its sha256 sums, decrypted with the private key and restored into a throwaway Postgres container of the same image: 8 tables compared, row counts identical to the live database. Repeat after changing the schema or the keys.
