# GOAL-06: Safety And Audit Controls

```yaml
id: BAK-G6
status: done
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Objective

Prevent unsafe retention, deletion, and restore behavior.

## Acceptance Criteria

- Retention below three full backups requires explicit owner approval metadata.
- Backup run deletion is disabled or owner-gated with audit reason.
- Production restore requires explicit approval fields and actor evidence.
- Audit logs include actor, target, job, run, action, and reason.
- UI makes destructive operations visibly distinct and hard to trigger accidentally.

## Non-Goals

- Do not delete existing backup runs as part of implementation.
- Do not perform production restore.
- Do not weaken existing auth behavior.

## Files To Inspect

```text
src/backup/backup.controller.ts
src/backup/backup.service.ts
src/jobs/dto/create-job.dto.ts
src/jobs/dto/update-job.dto.ts
src/restore/dto/create-restore.dto.ts
src/restore/restore.service.ts
src/auth/
web/admin/app.js
```

## Validation Plan

- Run `npm run build`.
- Run relevant tests.
- Verify unauthenticated destructive endpoints reject requests.
- Verify no secret values are logged or returned.
