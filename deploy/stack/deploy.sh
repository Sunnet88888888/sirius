#!/bin/bash
# Build and deploy the platform from the repository. Usage: deploy.sh [branch] | deploy.sh --rollback <sha>
# Expects: this script and docker-compose.yml, .env, analytics/ in /opt/learnhouse, and the repository cloned to /opt/learnhouse/src.
set -euo pipefail
cd /opt/learnhouse
COMPOSE=docker-compose.yml
set_image() { sed -i -E "s#^(\s*image:\s*)(ghcr.io/learnhouse/app:[^ ]+|sirius-lms:[^ ]+)#\1$1#" $COMPOSE; }
wait_health() { for i in $(seq 1 60); do curl -sf 127.0.0.1:8081/api/v1/health >/dev/null && return 0; sleep 5; done; return 1; }
if [ "${1:-}" = "--rollback" ]; then
  TAG="sirius-lms:$2"; docker image inspect "$TAG" >/dev/null
  set_image "$TAG"; docker compose up -d learnhouse-app; wait_health && echo "rolled back to $TAG"; exit 0
fi
BRANCH="${1:-main}"
cd src && git fetch -q origin && git checkout -q "$BRANCH" && git pull -q --ff-only origin "$BRANCH"
SHA=$(git rev-parse --short HEAD); cd ..
mkdir -p docs
LOG=docs/deploy-$SHA.log
{
  echo "== $(date -Is) deploy $BRANCH @ $SHA"
  docker build --build-arg LEARNHOUSE_PUBLIC=true -t sirius-lms:$SHA -f src/lms/Dockerfile src/lms
  cp $COMPOSE $COMPOSE.prev-$SHA
  set_image "sirius-lms:$SHA"
  docker compose up -d learnhouse-app
  if wait_health; then echo "OK sirius-lms:$SHA healthy"; else echo "FAILED health, rolling back"; cp $COMPOSE.prev-$SHA $COMPOSE; docker compose up -d learnhouse-app; exit 1; fi
} 2>&1 | tee "$LOG"
