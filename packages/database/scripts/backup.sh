#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/creatorhub_${TIMESTAMP}.sql"

# Load env
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

# Parse DATABASE_URL: postgresql://user:pass@host:port/dbname
DB_URL_PARSED=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):\([^@]*\)@\([^:]*\):\([0-9]*\)/\(.*\)|\1 \2 \3 \4 \5|p')
DB_USER=$(echo $DB_URL_PARSED | cut -d' ' -f1)
DB_PASS=$(echo $DB_URL_PARSED | cut -d' ' -f2)
DB_HOST=$(echo $DB_URL_PARSED | cut -d' ' -f3)
DB_PORT=$(echo $DB_URL_PARSED | cut -d' ' -f4)
DB_NAME=$(echo $DB_URL_PARSED | cut -d' ' -f5)

mkdir -p "$BACKUP_DIR"

echo "Backing up $DB_NAME at $DB_HOST:$DB_PORT..."

PGPASSWORD="$DB_PASS" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  -F p \
  -f "$BACKUP_FILE"

echo "Backup saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Keep only last 10 backups
ls -t "$BACKUP_DIR"/creatorhub_*.sql 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true

echo "Done."
