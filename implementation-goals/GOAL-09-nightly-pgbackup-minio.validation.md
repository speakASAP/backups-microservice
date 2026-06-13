# VAL-BAK-G9: Nightly PostgreSQL Backup To MinIO Validation

```yaml
id: VAL-BAK-G9
status: passed-not-deployed
validated_artifact: implementation-goals/GOAL-09-nightly-pgbackup-minio.md
owner: validator
created: 2026-06-13
last_updated: 2026-06-13
```

## Evidence

- Added `NightlyBackupBootstrapService`, which creates/updates a default PostgreSQL `BackupTarget` and enabled nightly `BackupJob` from environment configuration.
- `BackupService.onModuleInit()` calls the bootstrap before loading enabled jobs into the scheduler.
- `BackupModule` registers `BackupTarget` and `NightlyBackupBootstrapService` for DI.
- Kubernetes config now declares `BACKUPS_DEFAULT_NIGHTLY_ENABLED`, `BACKUP_TARGET_NAME`, `BACKUP_TARGET_SERVICE_OWNER`, `BACKUP_SCHEDULE_DB`, and `BACKUP_RETENTION_FULL_COUNT`.
- WAL-G remains the execution path via `WalgWrapperService.backupPush()` using `pgbackup --full-backup`.

## Gate Evidence

- `npm run build`: passed.
- `npm test -- --runInBand`: passed with 6 suites and 20 tests.
- `bash -n scripts/smoke-test.sh`: passed.
- `git diff --check`: passed.

## Backup Safety Evidence

- Startup creates scheduler metadata only; it does not trigger backup execution.
- Retention is clamped to at least seven full backups for the default nightly job.
- No secret values are persisted to target/job metadata.
- No backup deletion or production restore was performed.

## Recommendation

Ready for review. Deploy after deciding whether production should automatically create/enable the default nightly job from the configured environment.
