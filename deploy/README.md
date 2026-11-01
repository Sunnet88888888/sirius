# Deploying the platform on a new server

Layout on the server (the deploy script expects these paths):
```
/opt/learnhouse/            platform stack     <- deploy/stack/* , deploy/analytics/ (as analytics/)
/opt/learnhouse/src/        git clone of this repository
/opt/judge0/                code-execution stack <- deploy/judge0/*
```

## 1. Prepare the server
Ubuntu 22.04+, 4 GB RAM minimum (8 GB with analytics and Judge0), Docker with the compose plugin, git.
Before exposing it: SSH keys only, a firewall (22/80/443), fail2ban, HTTPS in front (see the security analysis in `docs/WORKLOG.md`).

## 2. Platform
```
git clone https://github.com/Sunnet88888888/sirius.git /opt/learnhouse/src
cd /opt/learnhouse
cp src/deploy/stack/docker-compose.yml src/deploy/stack/deploy.sh .
cp -r src/deploy/analytics analytics
cp src/deploy/stack/env.example .env && chmod 600 .env     # fill every <...>
./deploy.sh feat/self-hosted-analytics                     # builds sirius-lms:<sha>, starts, waits for health
```
`deploy.sh --rollback <sha>` returns to a previous image. The first build takes several minutes.

## 3. Code execution (optional, needed for code tasks)
```
cd /opt/judge0
cp /opt/learnhouse/src/deploy/judge0/docker-compose.yml .
cp /opt/learnhouse/src/deploy/judge0/judge0.conf.example judge0.conf && chmod 600 judge0.conf   # fill secrets
docker compose up -d
```
Put the same client id/secret in the platform `.env` (`LEARNHOUSE_JUDGE0_*`) and recreate the app: `docker compose up -d learnhouse-app`. Checks are in `docs/RUNBOOK.md`.

## 4. Analytics
Already included by the stack compose (`include: analytics/compose.yml`); see `analytics/README.md`.

## Not in git (keep it that way)
`.env`, `judge0.conf`, database and content volumes. Back them up separately (`docs/RUNBOOK.md`, Backup).
