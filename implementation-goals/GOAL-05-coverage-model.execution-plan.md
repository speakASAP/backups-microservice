# EP-BAK-G5: Coverage Model Execution Plan

```yaml
id: EP-BAK-G5
status: complete
source_goal: implementation-goals/GOAL-05-coverage-model.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
branch: codex/backups-goal-05-coverage-model
```

## Metadata

Goal `BAK-G5` extends backup target metadata so operators can see ecosystem coverage by service owner, source category, criticality, RPO/RTO, and restore class while preserving existing PostgreSQL backup behavior.

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Expanded intent plan: `docs/orchestrator/backup-intent-plan.md`
- Implementation state: `docs/IMPLEMENTATION_STATE.md`
- Goal: `implementation-goals/GOAL-05-coverage-model.md`
- Invariants: `docs/process/PROJECT_INVARIANTS.md`
- Operational gates: `docs/process/OPERATIONAL_GATES.md`

## Goal Impact

The goal improves operator visibility by distinguishing what is protected, what is merely discovered, and what source class each target represents. It prepares the model for MinIO bucket, Kubernetes resource, secret reference, and PVC coverage without implementing unsafe or incomplete backup mechanisms for those classes.

## Backup Safety Invariants

Applicable invariants: `BAK-INV-001`, `BAK-INV-003`, `BAK-INV-004`, `BAK-INV-007`, `BAK-INV-008`, `BAK-INV-009`.

## Sensitive-Data Handling

Only metadata and secret references may be stored or displayed. Secret values, tokens, raw credentials, private keys, sensitive backup artifact paths, and production data samples remain forbidden in source, docs, UI, logs, prompts, tests, and validation reports.

## Contract/Schema Impact

Add nullable/defaulted metadata columns to `backup_targets` through a new migration. Existing PostgreSQL targets remain valid because `type` defaults to `postgres`, connection fields remain unchanged, and new metadata fields are optional with conservative defaults.

## Scope

- Add source category, service owner, criticality, RPO/RTO, restore class, namespace, and coverage notes to backup targets.
- Document contracts for future non-Postgres source categories before implementation.
- Surface protected and unprotected discovered services in dashboard coverage.
- Preserve existing target, job, backup, restore, auth, and WAL-G behavior.

## Non-Goals

- Do not implement MinIO, Kubernetes resource, secret, or PVC backup execution.
- Do not expose secret values or raw backup artifact paths.
- Do not change production restore approval behavior.
- Do not harden deletion or retention beyond existing Goal 04/06 boundaries.
- Do not edit `BUSINESS.md` or `GOALS.md`.

## Files To Inspect

- `src/targets/entities/backup-target.entity.ts`
- `src/targets/dto/create-target.dto.ts`
- `src/targets/dto/update-target.dto.ts`
- `src/dashboard/dashboard.service.ts`
- `src/migrations/`
- `web/admin/app.js`
- `web/admin/index.html`
- `docs/orchestrator/backup-intent-plan.md`

## Files To Create

- `src/migrations/1748563500000-CoverageModel.ts`
- `implementation-goals/GOAL-05-coverage-model.context.md`
- `implementation-goals/GOAL-05-coverage-model.coding-prompt.md`
- `implementation-goals/GOAL-05-coverage-model.validation.md`

## Files To Modify

- `implementation-goals/GOAL-05-coverage-model.md`
- `src/targets/entities/backup-target.entity.ts`
- `src/targets/dto/create-target.dto.ts`
- `src/targets/dto/update-target.dto.ts`
- `src/dashboard/dashboard.service.ts`
- `web/admin/app.js`
- `web/admin/index.html`
- `docs/orchestrator/backup-intent-plan.md`
- `docs/IMPLEMENTATION_STATE.md`
- `STATE.json`
- `TASKS.md`

## Files That Must Not Be Modified

- `BUSINESS.md`
- `GOALS.md`
- Secret manifests or real secret values
- Production deployment state unless owner approval is explicit

## Implementation Steps

1. Add Goal 05 planning, context, prompt, and validation artifacts.
2. Run the documentation and invariant pre-coding gate.
3. Extend `BackupTarget` enums and metadata fields with backward-compatible defaults.
4. Add create/update DTO validation for metadata fields.
5. Add a migration with nullable/defaulted columns and a reversible down migration.
6. Extend dashboard summary coverage to include source category totals and discovered unprotected services.
7. Update admin dashboard rendering and target creation to show and capture coverage metadata.
8. Document future source-class contracts in the intent plan.
9. Run build, tests, admin JS syntax check, and secret/safety review.
10. Update validation and state artifacts.

## Test Plan

Run the existing build and Jest suite. Add focused tests only if existing coverage can exercise the new model without requiring a real database.

## Validation Plan

- `npm run build`
- `npm test -- --runInBand`
- `node --check web/admin/app.js`
- Manual review that new metadata does not expose secrets and PostgreSQL fields remain compatible.

## Gate Commands

```bash
npm run build
npm test -- --runInBand
node --check web/admin/app.js
```

## Documentation Updates

Update Goal 05 status, validation evidence, the intent plan contracts for source categories, and orchestration state files.

## Rollback Plan

Revert the Goal 05 branch before deployment. If migration has been applied, run its `down` method to drop only the newly added metadata columns.

## Agent Handoff Prompt

Implement Goal 05 on `codex/backups-goal-05-coverage-model`. Preserve PostgreSQL behavior, add only coverage metadata and UI/API visibility, document future source-class contracts, avoid secrets, do not deploy, commit, or push unless the owner asks, and return validation evidence.

## Completion Checklist

- [x] Implementation complete
- [x] Tests complete
- [x] Validation evidence collected
- [x] Documentation updated
- [x] Deviations documented
