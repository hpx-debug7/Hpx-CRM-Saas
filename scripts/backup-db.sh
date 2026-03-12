#!/usr/bin/env bash

set -e

# Load environment variables from .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo ".env file not found."
  exit 1
fi

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set."
  exit 1
fi

# Backup directory
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

# Timestamp
DATE=$(date +"%Y-%m-%d_%H-%M-%S")

# Backup file
BACKUP_FILE="$BACKUP_DIR/hpxeigencrm_$DATE.dump"

echo "Starting database backup..."

pg_dump \
  -d "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_FILE"

echo "Backup completed successfully."
echo "Backup file: $BACKUP_FILE"
