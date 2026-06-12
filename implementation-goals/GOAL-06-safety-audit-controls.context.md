# CTX-BAK-G6: Safety And Audit Controls Context

```yaml
id: CTX-BAK-G6
status: active
source_goal: implementation-goals/GOAL-06-safety-audit-controls.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Purpose

This context package preserves the Goal 06 safety intent before source edits. It summarizes current behavior, target behavior, constraints, and validation expectations for retention, deletion, restore approval, and audit logging.

## Required Reading

- `AGENTS.md`
- `TASKS.md`
- `STATE.json`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/backup-intent-plan.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/AGENT_ORCHESTRATION.md`
- `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- `docs/process/PROJECT_INVARIANTS.md`
- `docs/process/OPERATIONAL_GATES.md`
- `docs/orchestration/branch-workflow.md`
- `implementation-goals/README.md`
- `implementation-goals/GOAL-06-safety-audit-controls.md`

## Relevant Contracts

- Retention below three full backups is unsafe unless owner approval metadata is recorded.
- Agents must not delete backup runs or restore production targets without human approval.
- Production restore approval must name actor, target, backup run, and reason.
- Audit records for destructive or risk-changing actions must include actor, target, job, run, action, and reason where applicable.
- Management endpoints remain protected by the global JWT roles guard.
- Secrets, WAL-G output, and storage artifact paths must not be exposed in UI, logs, prompts, reports, or public API serialization.

## Current Behavior

- `CreateJobDto` and `UpdateJobDto` allow `retention_full_count >= 1`.
- Admin UI blocks retention below three, but the API does not.
- `DELETE /backups/:id` removes the backup run row with no approval reason.
- Restore requests accept only backup run ID and target ID, then execution starts asynchronously.
- Restore history stores `requested_by`, status, and WAL-G output internally but has no approval actor/reason/environment fields.
- No structured audit log entity exists.

## Target Behavior

- Jobs with retention below three are rejected unless explicit approval metadata is supplied.
- Retention weakening records approval metadata and an audit event.
- Backup-run deletion is disabled by default or requires explicit approval actor/reason and records an audit event.
- Production restore requires explicit approval actor, reason, target environment, and confirmation of backup run and target.
- Restore requests persist approval evidence before execution starts.
- Admin UI collects approval evidence for restore and shows retention approval state without exposing secrets.

## Constraints

- Do not delete backup runs during implementation.
- Do not execute production restore.
- Do not alter `BUSINESS.md` or `GOALS.md`.
- Do not deploy, commit, or push.
- Use additive migrations and preserve existing PostgreSQL backup behavior.
- Preserve Goal 05 copied baseline in this worktree and do not modify the original Goal 05 worktree.

## Validation Expectations

- `npm run build` passes.
- `npm test -- --runInBand` passes or failures are recorded with cause.
- `node --check web/admin/app.js` passes.
- Manual invariant review covers BAK-INV-001, 002, 003, 004, 005, 006, 008, and 009.
- Validation report records any blocked runtime checks.
