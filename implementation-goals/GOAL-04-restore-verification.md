# GOAL-04: Restore Verification Evidence

```yaml
id: BAK-G4
status: ready
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Objective

Treat restore verification as part of backup success evidence.

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Expanded intent plan: `docs/orchestrator/backup-intent-plan.md`
- IPS process: `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- Project invariants: `docs/process/PROJECT_INVARIANTS.md`
- Execution plan: `implementation-goals/GOAL-04-restore-verification.execution-plan.md`
- Context package: `implementation-goals/GOAL-04-restore-verification.context.md`
- Coding prompt: `implementation-goals/GOAL-04-restore-verification.coding-prompt.md`
- Validation report: `implementation-goals/GOAL-04-restore-verification.validation.md`

## Goal Impact

This goal reduces false confidence. A backup is not operational protection unless the system can show whether restore verification succeeded, failed, is pending, or was intentionally skipped with a reason.

## Acceptance Criteria

- Backup run status can represent verification lifecycle and result.
- Successful backup flow either runs a configured verification step or records why verification is pending/skipped.
- UI shows verification state per run and per target.
- Notifications distinguish backup success, verification success, and verification failure.
- `npm run build` passes.
- Relevant tests pass or missing test infrastructure is recorded.

## Non-Goals

- Do not perform production restore.
- Do not expose credentials, secret values, or sensitive artifact paths.
- Do not implement full service coverage inventory; that is Goal 05.
- Do not harden deletion/retention/approval controls beyond what is needed for verification; that is Goal 06.

## Files To Inspect

```text
src/backup/entities/backup-run.entity.ts
src/backup/backup.service.ts
src/restore/restore.service.ts
src/notifications/notifications.service.ts
src/dashboard/dashboard.service.ts
web/admin/app.js
web/admin/*.html
docs/orchestrator/INTENT.md
docs/orchestrator/backup-intent-plan.md
```

## Validation Plan

- Run `npm run build`.
- Run focused tests or `npm test -- --runInBand` if test dependencies are available.
- Run `node --check web/admin/app.js`.
- Manually verify that UI and API outputs do not include secret values.

## Safety Notes

Verification must be safe by default. If live restore verification is not implemented, record pending/skipped evidence explicitly rather than implying that the backup is fully verified.

## Required Pre-Coding Gate

Before source edits, complete:

- execution-plan review;
- context package review;
- coding prompt review;
- validation report shell;
- invariant checks for `BAK-INV-001`, `BAK-INV-002`, `BAK-INV-003`, `BAK-INV-004`, `BAK-INV-006`, `BAK-INV-008`, and `BAK-INV-009`;
- documentation gate from `docs/process/OPERATIONAL_GATES.md`.
