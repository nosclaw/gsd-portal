#!/bin/bash
# GSD Portal Backup Script
# Usage: ./backup.sh [backup_dir]
# Creates timestamped backup of SQLite DB + workspace directories
# Retains backups for 7 days

BACKUP_ROOT="${1:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/gsd-portal-$TIMESTAMP"

# 1. Create backup directory
mkdir -p "$BACKUP_DIR"

# 2. Backup SQLite database (with WAL checkpoint)
DB_PATH="/app/.runtime/data/portal.db"
if [ -f "$DB_PATH" ]; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/portal.db'" 2>/dev/null || cp "$DB_PATH" "$BACKUP_DIR/portal.db"
  echo "Database backed up"
fi

# 3. Tar workspace directories
tar -czf "$BACKUP_DIR/workspaces.tar.gz" -C /home . 2>/dev/null
echo "Workspaces backed up"

# 4. Cleanup old backups (older than 7 days)
find "$BACKUP_ROOT" -maxdepth 1 -name "gsd-portal-*" -type d -mtime +7 -exec rm -rf {} +
echo "Old backups cleaned"

echo "Backup complete: $BACKUP_DIR"
