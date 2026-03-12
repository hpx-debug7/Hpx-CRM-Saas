#!/bin/bash

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
echo "Usage: ./scripts/restore-db.sh <backup-file>"
exit 1
fi

pg_restore \
--clean \
--no-owner \
--no-privileges \
--dbname="$DATABASE_URL" \
"$BACKUP_FILE"

echo "Database restored from:"
echo "$BACKUP_FILE"
