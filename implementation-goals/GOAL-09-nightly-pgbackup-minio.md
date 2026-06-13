# GOAL-09: Nightly PostgreSQL Backup To MinIO

```yaml
id: BAK-G9
status: done
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```

## Objective

Ensure Backups creates and schedules a default nightly PostgreSQL logical backup job to MinIO-compatible storage.

## Acceptance Criteria

- Default nightly PostgreSQL backup target/job is created from environment configuration when enabled.
- Existing WAL-G logical `pgbackup --full-backup` execution remains the backup implementation.
- Nightly cron defaults to `BACKUP_SCHEDULE_DB` / `0 2 * * *`.
- Storage prefix uses `BACKUP_STORAGE_PREFIX` or `WALG_S3_PREFIX/<database>`.
- Startup does not trigger a backup; it only ensures scheduler state.
- No secrets are exposed in source, logs, tests, docs, or UI.

## Non-Goals

- Do not run a production backup during implementation.
- Do not delete backup runs or backup artifacts.
- Do not perform restore.
- Do not expose MinIO, DB, or service token values.

## Validation Plan

- Run `npm run build`.
- Run `npm test -- --runInBand`.
- Run `bash -n scripts/smoke-test.sh` and `git diff --check`.
- Deploy only after owner approval; this change schedules future backups but does not immediately trigger one.
