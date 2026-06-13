# CTX-BAK-G6: Safety And Audit Controls Context Package

```yaml
id: CTX-BAK-G6
status: active
source_goal: implementation-goals/GOAL-06-safety-audit-controls.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```

## Purpose

Provide implementation context for hardening retention, backup-run deletion, production restore approval, and audit evidence without weakening Auth, restore verification, coverage model, or secret-handling boundaries.

## Required Reading

- `AGENTS.md`
- `TASKS.md`
- `STATE.json`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/backup-intent-plan.md`
- `docs/IMPLEMENTATION_STATE.md`
- `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- `docs/AGENT_ORCHESTRATION.md`
- `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- `docs/process/PROJECT_INVARIANTS.md`
- `docs/process/OPERATIONAL_GATES.md`
- `docs/orchestration/branch-workflow.md`
- `implementation-goals/README.md`
- `implementation-goals/GOAL-06-safety-audit-controls.md`

## Relevant Contracts

- Auth: global `JwtRolesGuard` protects management endpoints by default; public exceptions are explicit.
- Backup runs: public serialization hides `storage_path` and `walg_output`; preserve this.
- Retention: counts below three full backups are unsafe unless owner approval metadata is supplied and audited.
- Restore: production restore is destructive and must include target, backup run, actor, and reason evidence.
- Audit: destructive or risk-changing operations must record actor, target, job, run, action, and reason where applicable.
- Coverage: Goal 05 contract-only source categories remain non-executable for backup jobs.

## Current Behavior

- `CreateJobDto` and `UpdateJobDto` allow `retention_full_count` as low as 1.
- Admin UI blocks retention below 3, but backend does not.
- `BackupService.remove` physically removes backup-run rows.
- `BackupController.remove` accepts no actor/reason body and performs deletion.
- `CreateRestoreDto` only includes backup run and target IDs.
- `RestoreController` falls back to `unknown` actor if the guard payload is missing.
- `RestoreService.create` immediately starts execution after request creation.
- Existing UI warns about restore but says backend approval fields are a future goal.

## Target Behavior

- Backend blocks or owner-gates retention below three full backups using actor, reason, and timestamp metadata.
- Backup-run deletion is disabled by default and denied attempts are audited with actor/run/job/action/reason when available.
- Restore create requires explicit approval actor, reason, target confirmation, backup-run confirmation, and production confirmation.
- Audit events persist actor, action, reason, and target/job/run/request references for safety-relevant operations.
- Admin UI makes destructive restore and low-retention policy visibly distinct and harder to trigger accidentally.

## Constraints

- Do not perform a restore or delete any backup run.
- Do not deploy, commit, or push.
- Do not expose secret values or raw artifact paths.
- Do not edit `BUSINESS.md` or `GOALS.md`.
- Preserve Goal 05 coverage model behavior and PostgreSQL-only executable job guard.

## Validation Expectations

- Documentation gate passes before source edits.
- `npm run build` passes.
- `npm test -- --runInBand` passes.
- `node --check web/admin/app.js` passes.
- Protected management endpoint remains unauthenticated `401` or `403`.
- Secret/safety scan finds no secret values or destructive validation actions.
