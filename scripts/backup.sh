#!/usr/bin/env bash
# Snapshot the live worlds directory to ./backups/.
#
# BDS buffers writes, so we flush with `save hold` / `save query` / `save resume`
# via the container's send-command helper before copying. Without that you can
# capture a torn world.
set -euo pipefail

cd "$(dirname "$0")/.."

CONTAINER="${CONTAINER:-mystery-bedrock}"
LEVEL_NAME="${LEVEL_NAME:-$(grep -E '^LEVEL_NAME=' .env 2>/dev/null | cut -d= -f2- || echo mystery)}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/${LEVEL_NAME}-${STAMP}.tar.gz"

mkdir -p backups

running=$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)

if [ "$running" = "true" ]; then
  echo "==> Asking the server to flush its world to disk"
  docker exec "$CONTAINER" send-command save hold
  # Poll until BDS reports the snapshot is ready.
  for _ in $(seq 1 30); do
    sleep 1
    if docker exec "$CONTAINER" send-command save query >/dev/null 2>&1; then
      break
    fi
  done
else
  echo "==> Container not running; copying world files directly"
fi

echo "==> Writing $OUT"
tar -czf "$OUT" -C data "worlds/${LEVEL_NAME}"

if [ "$running" = "true" ]; then
  echo "==> Resuming normal saves"
  docker exec "$CONTAINER" send-command save resume
fi

echo "==> Done: $OUT ($(du -h "$OUT" | cut -f1))"
