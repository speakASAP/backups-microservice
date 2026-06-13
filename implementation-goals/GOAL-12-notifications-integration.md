# BAK-G12: NotificationsModule Integration

```yaml
id: BAK-G12
status: implemented-not-deployed
owner: codex
created: 2026-06-13
last_updated: 2026-06-13
depends_on:
  - BAK-G11
upstream:
  - docs/orchestrator/INTENT.md
  - docs/process/PROJECT_INVARIANTS.md
```

## Objective

Integrate Backups success/failure notifications through a typed NotificationsModule contract so backup, restore, verification, and retention outcomes emit consistent non-secret operational events.

## Goal Impact

Operators need success and failure signals without checking every backup run manually. Notification payloads must preserve disaster-recovery evidence while excluding secrets, raw WAL-G output, storage artifact paths, and credentials.

## Acceptance Criteria

- Backup success and failure use typed notification helpers.
- Restore completion and failure use typed notification helpers.
- Verification pending, verified, and failed outcomes are distinguished from backup success.
- Retention cleanup success and failure emit notifications.
- Notification dispatch remains best-effort and never fails backup/restore execution.
- Notification payloads redact sensitive keys and omit undefined values.
- Focused tests cover event names, disabled configuration, error swallowing, and redaction.

## Non-Goals

- Do not add a new notification transport beyond the existing HTTP integration.
- Do not expose secret values in source, tests, docs, logs, or notification payloads.
- Do not trigger a backup, delete backup runs, or execute a restore.
- Do not deploy without owner approval.

## Files To Inspect

- `src/notifications/notifications.service.ts`
- `src/backup/backup.service.ts`
- `src/restore/restore.service.ts`
- `src/retention/retention.service.ts`
- `src/config/configuration.ts`
- `docs/process/PROJECT_INVARIANTS.md`

## Validation Plan

- `npm run build`
- `npm test -- --runInBand`
- `bash -n scripts/smoke-test.sh`
- `git diff --check`
- Secret-oriented review of changed notification payloads.
