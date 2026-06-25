# CTX-BAK-15: Disaster Recovery Catalog UI

```yaml
id: CTX-BAK-15
status: completed
source_goal: implementation-goals/GOAL-15-disaster-recovery-catalog-ui.md
owner: orchestrator
created: 2026-06-25
last_updated: 2026-06-25
```

## Purpose

Provide executor context for showing Phase 0 DR catalog evidence in the Backups dashboard.

## Required Reading

- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/BACKUP_CONSOLIDATION_PLAN.md`
- `docs/process/PROJECT_INVARIANTS.md`
- `docs/process/OPERATIONAL_GATES.md`
- `src/dashboard/dashboard.service.ts`
- `web/admin/index.html`
- `web/admin/app.js`
- `k8s/deployment.yaml`

## Relevant Contracts

`/dashboard/summary` already returns `external_evidence.database_server` and `external_evidence.vault`. Goal 15 adds `external_evidence.disaster_recovery_catalog` as an additive sanitized object. Existing auth guard remains unchanged.

## Current Behavior

Dashboard shows database and Vault evidence, but not the Phase 0 catalog families, legacy-review lanes, or missing lanes from `/home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery/latest.json`.

## Target Behavior

Dashboard summary and admin UI show the DR catalog as sanitized metadata, including current protected inputs, keep-indexed evidence sources, legacy-review paths, missing lanes, and next actions.

## Constraints

Do not expose secrets, dump contents, Kubernetes Secret `.data`, encrypted archive contents, or root-only secret material paths. Do not touch raw payloads or runtime schedules.

## Validation Expectations

Build, tests, JS syntax, diff check, JSON check, and unauthenticated summary check must pass or blockers must be recorded.
