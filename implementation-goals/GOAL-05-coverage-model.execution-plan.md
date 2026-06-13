# EP-BAK-G5: Ecosystem Coverage Model

```yaml
id: EP-BAK-G5
status: approved
source_goal: implementation-goals/GOAL-05-coverage-model.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
```

## Goal Impact

Make ecosystem backup coverage visible beyond the database-only execution path while preserving PostgreSQL WAL-G behavior. Operators can see service owner, source category, criticality, RPO/RTO, and restore class without implying unsupported source categories are executable.

## Traceability And Safety

Upstream: docs/orchestrator/INTENT.md, docs/orchestrator/backup-intent-plan.md, docs/process/INTENT_PRESERVATION_SYSTEM.md, docs/process/PROJECT_INVARIANTS.md.
Safety: metadata only; no secret values, raw production data, signed URLs, or sensitive backup artifact paths. Contract-only sources must not get executable WAL-G jobs.
Validation: npm run build; npm test -- --runInBand; node --check web/admin/app.js.

## Scope

Create Goal 05 IPS artifacts, add the `backup_targets` coverage migration, expose source contracts in dashboard summary/UI, reject executable jobs for non-PostgreSQL source categories, add enum tests, and update state.

## Non-Goals

Do not implement MinIO, Kubernetes, secret, or PVC backup execution. Do not change restore approval, retention/deletion controls, protected intent docs, deployment manifests, `BUSINESS.md`, or `GOALS.md`.

## Files

Create `src/migrations/1748563500000-CoverageModel.ts` and `test/backup-target-enums.spec.ts`. Modify `src/jobs/*`, `src/dashboard/dashboard.service.ts`, `web/admin/app.js`, `web/admin/index.html`, Goal 05 docs, `docs/IMPLEMENTATION_STATE.md`, `STATE.json`, and `TASKS.md`.

## Rollback

Revert only Goal 05 changed files. If migration was applied, run its down migration to drop the nullable/defaulted coverage columns.
