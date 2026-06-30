#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"

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

# Find latest backup or use provided argument
if [ "${1:-}" != "" ]; then
  BACKUP_FILE="$1"
else
  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/creatorhub_*.sql 2>/dev/null | head -1)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: No backup file found in $BACKUP_DIR"
  echo "Usage: $0 [backup_file.sql]"
  exit 1
fi

DB_URL_PARSED=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):\([^@]*\)@\([^:]*\):\([0-9]*\)/\(.*\)|\1 \2 \3 \4 \5|p')
DB_USER=$(echo $DB_URL_PARSED | cut -d' ' -f1)
DB_PASS=$(echo $DB_URL_PARSED | cut -d' ' -f2)
DB_HOST=$(echo $DB_URL_PARSED | cut -d' ' -f3)
DB_PORT=$(echo $DB_URL_PARSED | cut -d' ' -f4)
DB_NAME=$(echo $DB_URL_PARSED | cut -d' ' -f5)

echo "WARNING: This will OVERWRITE the current database '$DB_NAME'!"
echo "Restoring from: $BACKUP_FILE"
read -p "Type 'RESTORE' to confirm: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 1
fi

echo "Dropping and recreating database..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" 2>/dev/null
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" 2>/dev/null

echo "Restoring..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE" --quiet

echo "Restore complete from: $BACKUP_FILE"
