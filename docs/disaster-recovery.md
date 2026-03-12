# Disaster Recovery: Database Restore Guide

This document provides instructions for restoring the PostgreSQL database from a custom-format dump file.

## Prerequisites
- PostgreSQL client tools (`pg_restore`, `psql`, `createdb`) must be installed.
- Access to the database environment variables (specifically `DATABASE_URL`).

## Step 1: Locate the Latest Backup
Backups are stored in the `backups/` directory with timestamped filenames:
- Location: `./backups/hpxeigencrm_YYYY-MM-DD_HH-MM-SS.dump`

## Step 2: Create a Target Database (Optional)
If you are restoring to a new database:
```bash
createdb <new_db_name>
```

## Step 3: Restore the Dump
Execute the `pg_restore` command. Use the `--clean` flag if restoring to an existing database to drop objects before recreating them.

```bash
pg_restore \
  --dbname=postgresql://user:password@localhost:5432/dbname \
  --clean \
  --no-owner \
  --no-privileges \
  ./backups/<latest_backup_file>.dump
```

*Note: You may see warnings about non-existent objects if the database is currently empty. These are safe to ignore.*

## Step 4: Verify the Restore
Confirm that the tables have been recreated:
```bash
psql -d <db_name> -c "\dt"
```

Check the record count of a core table (e.g., `companies`):
```bash
psql -d <db_name> -c "SELECT count(*) FROM companies;"
```
