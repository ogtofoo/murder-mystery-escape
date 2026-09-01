#!/usr/bin/env bash
# Restore a world snapshot created by backup.sh.
# Usage: ./scripts/restore.sh backups/mystery-20260901-120000.tar.gz
set -euo pipefail

cd "$(dirname "$0")/.."

ARCHIVE="${1:-}"
if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Usage: $0 <backup.tar.gz>" >&2
  echo "Available:" >&2
  ls -1 backups/*.tar.gz 2>/dev/null >&2 || echo "  (none)" >&2
  exit 1
fi

echo "This OVERWRITES the current world in ./data/worlds/ with $ARCHIVE."
read -r -p "Type 'yes' to continue: " confirm
[ "$confirm" = "yes" ] || { echo "Aborted."; exit 1; }

echo "==> Stopping server"
docker compose stop bedrock

echo "==> Extracting"
tar -xzf "$ARCHIVE" -C data

echo "==> Starting server"
docker compose up -d

echo "==> Restored from $ARCHIVE"
