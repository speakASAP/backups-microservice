# EP-BAK-G6: Safety And Audit Controls Execution Plan

```yaml
id: EP-BAK-G6
status: active
source_goal: implementation-goals/GOAL-06-safety-audit-controls.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
branch: codex/backups-goal-05-coverage-model
branch_deviation: Goal 06 branch exists, but Goal 05 dependency changes are uncommitted on this branch; continue here and record deviation.
```

## Metadata

- Goal: BAK-G6 Safety And Audit Controls.
- Lifecycle state: active implementation.
- Remote source of truth: `/home/ssf/Documents/Github/backups-microservice` on `alfares`.
- Dirty worktree note: Goal 05 validated changes are present and must not be reverted.

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md` rules 4, 6, 7, and 9.
- Intent expansion: `docs/orchestrator/backup-intent-plan.md` section BAK-G6.
- Implementation state: `docs/IMPLEMENTATION_STATE.md` marks BAK-G6 as the next action after BAK-G5.
- Goal source: `implementation-goals/GOAL-06-safety-audit-controls.md`.
- Process: `docs/process/INTENT_PRESERVATION_SYSTEM.md`, `docs/process/PROJECT_INVARIANTS.md`, and `docs/process/OPERATIONAL_GATES.md`.

## Goal Impact

This goal hardens the disaster-recovery control plane by making risk-changing and destructive behavior fail closed unless operator approval evidence is recorded. It prevents silent retention weakening, disables accidental backup-run deletion, requires production restore approval fields, and leaves audit evidence with actor, target, job, run, action, and reason.

## Backup Safety Invariants

- BAK-INV-001: Backups remains owner of backup orchestration, restore evidence, retention guardrails, and operator status only.
- BAK-INV-002: Production restore requires explicit human approval with target, backup run, actor, and reason evidence.
- BAK-INV-003: No secrets, raw credentials, or sensitive backup artifact paths in UI, logs, prompts, reports, tests, or API responses.
- BAK-INV-005: Retention below three full backups requires explicit owner approval metadata.
- BAK-INV-006: Destructive or risk-changing operations record actor, target, action, and reason.
- BAK-INV-008: Management endpoints stay protected by Auth-owned identity and RBAC.
- BAK-INV-009: Preserve execution plan, context package, coding prompt, validation report, and state update chain.

## Sensitive-Data Handling

The implementation must store and return approval/audit metadata only, not secret values. Public backup-run serialization must continue hiding `storage_path` and `walg_output`. Restore history must not expose WAL-G output. Tests must use synthetic UUIDs and reason strings only.

## Contract/Schema Impact

Schema additions are expected:

- `backup_jobs`: retention approval actor, reason, and timestamp.
- `restore_requests`: approval actor, reason, target confirmation, backup-run confirmation, and production confirmation.
- New `audit_events` table/entity for actor, target, job, run, action, reason, and metadata.

API additions are expected:

- Job create/update accepts low-retention approval metadata when `retention_full_count < 3`.
- Restore create requires approval fields and explicit target/run confirmations.
- Backup-run delete is disabled at the backend by default.

## Scope

Implement backend guardrails, audit event persistence, focused tests, and admin UI changes for Goal 06 safety controls.

## Non-Goals

- Do not delete backup runs or artifacts.
- Do not execute production restore for validation.
- Do not deploy, commit, or push.
- Do not weaken Auth guard behavior.
- Do not expose secrets or backup artifact paths.
- Do not alter Business or Goals owner documents.

## Files To Inspect

- `src/backup/backup.controller.ts`
- `src/backup/backup.service.ts`
- `src/jobs/dto/create-job.dto.ts`
- `src/jobs/dto/update-job.dto.ts`
- `src/jobs/jobs.service.ts`
- `src/jobs/entities/backup-job.entity.ts`
- `src/restore/dto/create-restore.dto.ts`
- `src/restore/restore.service.ts`
- `src/restore/entities/restore-request.entity.ts`
- `src/auth/`
- `web/admin/app.js`
- `web/admin/jobs.html`
- `web/admin/restore.html`

## Files To Create

- `src/audit/audit.module.ts`
- `src/audit/audit.service.ts`
- `src/audit/entities/audit-event.entity.ts`
- `src/migrations/1748563600000-SafetyAuditControls.ts`
- Focused tests under `test/` for safety DTO/entity/service behavior.

## Files To Modify

- Goal artifacts for BAK-G6.
- `src/app.module.ts`
- `src/backup/backup.controller.ts`
- `src/backup/backup.service.ts`
- `src/jobs/dto/create-job.dto.ts`
- `src/jobs/dto/update-job.dto.ts`
- `src/jobs/entities/backup-job.entity.ts`
- `src/jobs/jobs.service.ts`
- `src/restore/dto/create-restore.dto.ts`
- `src/restore/entities/restore-request.entity.ts`
- `src/restore/restore.service.ts`
- `web/admin/app.js`
- `web/admin/jobs.html`
- `web/admin/restore.html`
- `docs/IMPLEMENTATION_STATE.md`
- `STATE.json`
- `TASKS.md`

## Files That Must Not Be Modified

- `BUSINESS.md`
- `GOALS.md`
- Vault, Kubernetes secret values, and runtime credentials.
- Unrelated Goal 05 changes except where integration is required.

## Implementation Steps

1. Add audit event entity/module/service and migration.
2. Add retention approval fields to job DTO/entity/migration and validate low-retention changes in `JobsService`.
3. Disable backup-run deletion by default and record denied delete attempts with actor, run, job, action, and reason.
4. Add restore approval DTO/entity fields and validate actor, target/run confirmations, production confirmation, and reason before creating a request.
5. Emit audit events for job create/update retention changes, denied backup-run deletion, and restore request creation/execution outcomes.
6. Update admin UI so low retention requires owner approval metadata and restore submission requires target/run confirmation plus reason.
7. Add focused tests for retention approval, restore approval DTO fields, and audit event enums/entity contracts.
8. Run build, tests, admin JS syntax, unauthenticated protected endpoint checks, and secret/safety scans.
9. Update validation report and implementation state.

## Test Plan

- Add focused Jest tests for low-retention approval guard behavior.
- Add entity/DTO contract tests for audit events and restore approval fields.
- Run `npm test -- --runInBand`.

## Validation Plan

- `npm run build`
- `npm test -- --runInBand`
- `node --check web/admin/app.js`
- `curl -sk -o /dev/null -w "%{http_code}
" https://backups.alfares.cz/jobs` to verify protected endpoints reject unauthenticated requests.
- Manual source review for no secret exposure and no backup-run deletion.

## Gate Commands

```bash
npm run build
npm test -- --runInBand
node --check web/admin/app.js
curl -sk -o /dev/null -w "%{http_code}
" https://backups.alfares.cz/jobs
```

## Documentation Updates

- Update `implementation-goals/GOAL-06-safety-audit-controls.validation.md` with evidence.
- Update `docs/IMPLEMENTATION_STATE.md`, `STATE.json`, and `TASKS.md` after validation.

## Rollback Plan

Revert only Goal 06 files from the remote branch, leaving Goal 05 changes intact. Schema rollback is provided by the new TypeORM migration `down` method. Do not delete backup data during rollback.

## Agent Handoff Prompt

Implement BAK-G6 safety and audit controls in the remote Backups repo. Preserve Goal 05 changes. Add fail-closed backend controls for retention below three full backups, backup-run deletion, production restore approval evidence, and audit event persistence. Update the admin UI for visible destructive-operation friction. Run build/tests/admin syntax and record validation evidence. Do not deploy, commit, push, delete backup runs, run a production restore, or expose secrets.

## Completion Checklist

- [ ] Implementation complete
- [ ] Tests complete
- [ ] Validation evidence collected
- [ ] Documentation updated
- [ ] Deviations documented
