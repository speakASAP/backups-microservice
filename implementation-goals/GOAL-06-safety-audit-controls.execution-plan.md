# EP-BAK-G6: Safety And Audit Controls

```yaml
id: EP-BAK-G6
status: complete
source_goal: implementation-goals/GOAL-06-safety-audit-controls.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: implementation-ready
branch: codex/backups-goal-06-safety-audit-controls
worktree: /home/ssf/Documents/Github/backups-microservice-goal06
```

## Metadata

Goal 06 is being implemented in a separate remote worktree because the original `/home/ssf/Documents/Github/backups-microservice` worktree contains uncommitted Goal 05 changes. The Goal 05 dirty files were copied into this worktree as the dependency baseline; the original worktree was not modified.

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Backup scope: `docs/orchestrator/backup-intent-plan.md`
- Current state: `docs/IMPLEMENTATION_STATE.md`
- Selected goal: `implementation-goals/GOAL-06-safety-audit-controls.md`
- IPS: `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- Invariants: `docs/process/PROJECT_INVARIANTS.md`
- Gates: `docs/process/OPERATIONAL_GATES.md`

## Goal Impact

This goal makes unsafe actions explicit and auditable: retention below three full backups requires owner approval metadata, backup-run deletion is blocked or owner-gated with reason, production restore requires named approval evidence, and risk-changing operations emit audit records.

## Backup Safety Invariants

- BAK-INV-001: Backups owns orchestration and evidence, not application-domain data.
- BAK-INV-002: Production restore requires explicit human approval with target, run, actor, and reason.
- BAK-INV-003: Secret values and raw backup artifact paths must not be exposed.
- BAK-INV-004: Restore verification status remains visible for successful backups.
- BAK-INV-005: Retention below three full backups requires explicit owner approval metadata.
- BAK-INV-006: Destructive or risk-changing operations record actor, target, action, and reason.
- BAK-INV-008: Management endpoints remain protected by the existing auth guard.
- BAK-INV-009: IPS artifacts, gates, validation, and state updates are required.

## Sensitive-Data Handling

Do not log secret values, WAL-G output, storage artifact paths, tokens, private keys, or raw production data. Public backup run serialization must continue omitting `storage_path` and `walg_output`. Audit events may include IDs, actor, action, reason, target ID, job ID, run ID, environment, and approved-by metadata only.

## Contract/Schema Impact

- Add retention approval metadata to backup jobs.
- Add restore approval metadata to restore requests.
- Add a structured audit log table/entity for safety-sensitive operations.
- Add an additive migration only; no destructive data migration.
- Keep PostgreSQL target and backup-run public contracts backward compatible except for extra safety metadata fields.

## Scope

Implement API, service, schema, audit, validation, and admin UI changes for retention guardrails, backup-run deletion gating, and production restore approval evidence.

## Non-Goals

- Do not delete existing backup runs.
- Do not perform any restore.
- Do not deploy, commit, or push.
- Do not modify `BUSINESS.md` or `GOALS.md`.
- Do not implement new backup source executors.
- Do not weaken authentication or expose secrets.

## Files To Inspect

- `src/backup/backup.controller.ts`
- `src/backup/backup.service.ts`
- `src/jobs/dto/create-job.dto.ts`
- `src/jobs/dto/update-job.dto.ts`
- `src/jobs/entities/backup-job.entity.ts`
- `src/jobs/jobs.service.ts`
- `src/restore/dto/create-restore.dto.ts`
- `src/restore/restore.controller.ts`
- `src/restore/restore.service.ts`
- `src/restore/entities/restore-request.entity.ts`
- `src/auth/`
- `web/admin/app.js`
- `web/admin/jobs.html`
- `web/admin/restore.html`

## Files To Create

- `src/audit/audit-log.entity.ts`
- `src/audit/audit.service.ts`
- `src/audit/audit.module.ts`
- `src/migrations/1748563600000-SafetyAuditControls.ts`
- Goal 06 IPS artifacts and validation report.

## Files To Modify

- `src/app.module.ts`
- `src/backup/backup.controller.ts`
- `src/backup/backup.module.ts`
- `src/backup/backup.service.ts`
- `src/jobs/dto/create-job.dto.ts`
- `src/jobs/dto/update-job.dto.ts`
- `src/jobs/entities/backup-job.entity.ts`
- `src/jobs/jobs.service.ts`
- `src/restore/dto/create-restore.dto.ts`
- `src/restore/entities/restore-request.entity.ts`
- `src/restore/restore.module.ts`
- `src/restore/restore.service.ts`
- `web/admin/app.js`
- `web/admin/jobs.html`
- `web/admin/restore.html`
- `web/admin/styles.css`
- `docs/IMPLEMENTATION_STATE.md`
- `STATE.json`
- `TASKS.md`

## Files That Must Not Be Modified

- `BUSINESS.md`
- `GOALS.md`
- Kubernetes deploy manifests unless explicitly required by validation.
- Production secrets or environment files.

## Implementation Steps

1. Add audit log entity, module, and service with safe structured fields.
2. Add additive migration for audit logs, retention approval metadata, and restore approval metadata.
3. Enforce retention guardrails in job create/update service logic.
4. Replace silent backup-run removal with owner-gated audit behavior; default to disabling physical deletion unless approval metadata is provided.
5. Require explicit production restore approval fields and reason in the restore DTO/service.
6. Add audit events for manual backup trigger, retention policy weakening, backup-run deletion request, and restore request/execution outcome.
7. Update admin UI to collect restore approval fields, show retention approval state, and keep destructive actions visually distinct.
8. Run narrow gates and update validation/state artifacts.

## Test Plan

Add focused service tests if existing test harness supports them. At minimum, run build, existing Jest suites, admin JavaScript syntax check, unauthenticated destructive endpoint checks where runtime is available, and manual invariant review.

## Validation Plan

- `npm run build`
- `npm test -- --runInBand`
- `node --check web/admin/app.js`
- Manual review that public API output omits secret values, WAL-G output, and storage paths.
- Manual review that retention below three is rejected without approval metadata.
- Manual review that production restore requires approval fields.
- Manual review that backup-run deletion is owner-gated and audited.

## Gate Commands

```bash
npm run build
npm test -- --runInBand
node --check web/admin/app.js
```

## Documentation Updates

Update Goal 06 validation, `docs/IMPLEMENTATION_STATE.md`, `STATE.json`, and `TASKS.md` with command evidence, safety review, and next action.

## Rollback Plan

Revert Goal 06 files in the isolated worktree. The original Goal 05 worktree remains untouched. Database changes are additive and include a migration `down` path for removing new columns/table if the migration has not been adopted.

## Agent Handoff Prompt

Implement BAK-G6 in `/home/ssf/Documents/Github/backups-microservice-goal06` only. Preserve Goal 05 copied baseline, do not edit local backup copies, do not deploy/commit/push, do not touch `BUSINESS.md` or `GOALS.md`, and keep all safety evidence secret-safe. Follow this execution plan and update validation/state artifacts before reporting completion.

## Completion Checklist

- [x] Implementation complete
- [x] Tests complete
- [x] Validation evidence collected
- [x] Documentation updated
- [x] Deviations documented
