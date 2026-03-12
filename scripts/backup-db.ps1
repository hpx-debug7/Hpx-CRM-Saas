$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BACKUP_DIR = "./backups"

# Ensure backup directory exists
if (!(Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR
}

$BACKUP_FILE = "$BACKUP_DIR/hpxeigencrm_$DATE.dump"

Write-Host "Starting database backup..."

# Extract connection string from current context or env
# PGPASSWORD should be set in environment or handled by pg_dump
$env:PGPASSWORD = "admin123"
$DATABASE_URL = "postgresql://admin:admin123@localhost:5432/hpxeigencrm"

pg_dump -d "$DATABASE_URL" `
--format=custom `
--no-owner `
--no-privileges `
--file="$BACKUP_FILE"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully."
    Write-Host "Backup file: $BACKUP_FILE"
    Write-Host "Backup time: $((Get-Date).ToString())"
} else {
    Write-Host "Backup failed."
    exit 1
}
