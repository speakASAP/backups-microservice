# BAK-G13: LoggingModule Integration

```yaml
id: BAK-G13
status: implemented-not-deployed
owner: codex
created: 2026-06-13
last_updated: 2026-06-13
depends_on:
  - BAK-G12
upstream:
  - docs/orchestrator/INTENT.md
  - docs/process/PROJECT_INVARIANTS.md
```

## Objective

Integrate structured, redacted operational logging for backup, restore, retention, audit, and scheduler lifecycle events.

## Goal Impact

Backups needs searchable operational logs that correlate control-plane state transitions without exposing secrets or raw backup/restore artifacts.

## Acceptance Criteria

- Logger service supports structured operation events with typed levels and metadata.
- Logger service redacts secret-like keys recursively before local file writes and remote logging transport.
- Backup, restore, retention, audit, and job lifecycle paths emit structured operational events.
- Remote logging remains best-effort and cannot fail backup, restore, retention, or audit flows.
- Focused tests cover redaction, remote payload shape, disabled remote transport, and error swallowing.

## Non-Goals

- Do not add a new database table for logs.
- Do not replace persisted audit events.
- Do not trigger a backup, delete backup runs, execute a restore, or deploy.
- Do not expose secret values in source, tests, logs, docs, or payload examples.

## Files To Inspect

- `shared/logger/logger.service.ts`
- `shared/logger/logger.module.ts`
- `src/backup/backup.service.ts`
- `src/restore/restore.service.ts`
- `src/retention/retention.service.ts`
- `src/jobs/jobs.service.ts`
- `src/audit/audit.service.ts`

## Validation Plan

- `npm run build`
- `npm test -- --runInBand`
- `bash -n scripts/smoke-test.sh`
- `git diff --check`
- Secret-oriented scan of changed files.
