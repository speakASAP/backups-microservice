# GOAL-11: Restore From MinIO And Verify

```yaml
id: BAK-G11
status: done
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```

## Objective

Harden restore execution from MinIO/WAL-G and record restore verification evidence on the backup run.

## Acceptance Criteria

- Restore requests still require exact backup run, target, actor, reason, and production approval evidence.
- Only successful backup runs can be restored.
- WAL-G restore uses an isolated per-request working directory.
- Restore execution selects an explicit WAL-G backup name when output evidence contains one, with `LATEST` fallback.
- Backup-run verification status is updated to verifying, verified, or failed based on restore execution outcome.
- No restore is executed during implementation validation.

## Non-Goals

- Do not run a production restore during implementation.
- Do not delete backup runs or artifacts.
- Do not expose WAL-G output or storage paths in public responses.
