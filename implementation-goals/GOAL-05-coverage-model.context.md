# CTX-BAK-G5: Coverage Model Context Package

```yaml
id: CTX-BAK-G5
status: active
source_goal: implementation-goals/GOAL-05-coverage-model.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Purpose

This context package anchors Goal 05 implementation to the disaster-recovery intent: Backups must show coverage across ecosystem sources without taking ownership of application data or exposing secrets.

## Required Reading

- `AGENTS.md`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/backup-intent-plan.md`
- `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- `docs/process/PROJECT_INVARIANTS.md`
- `docs/process/OPERATIONAL_GATES.md`
- `implementation-goals/GOAL-05-coverage-model.md`
- `implementation-goals/GOAL-05-coverage-model.execution-plan.md`
- `src/targets/entities/backup-target.entity.ts`
- `src/dashboard/dashboard.service.ts`
- `web/admin/app.js`

## Relevant Contracts

- Backups owns target metadata, jobs, backup runs, restore requests, restore verification evidence, and operator status.
- Application services own domain data.
- Vault and Kubernetes secret references may be stored; secret values must never be displayed or persisted in this goal.
- PostgreSQL targets remain executable through the existing WAL-G flow.
- Non-Postgres source classes are metadata/contracts only in this goal.
- Management APIs remain protected by the existing auth/RBAC boundary.

## Current Behavior

Targets currently identify PostgreSQL host, port, database, secret reference, type, and enabled state. Dashboard coverage shows configured targets and live Kubernetes discovery separately, but it cannot classify service owner, source category, criticality, RPO/RTO, restore class, or unprotected discovered services as coverage gaps.

## Target Behavior

Targets can carry ecosystem coverage metadata. Dashboard summary returns coverage stats, protected configured targets, and unprotected discovered services. The admin dashboard displays metadata and can create PostgreSQL targets with owner/RPO/RTO/criticality/restore-class values.

## Constraints

- Do not implement backup execution for MinIO, Kubernetes resources, secrets, or PVCs.
- Do not expose secret values, raw credentials, or sensitive artifact paths.
- Do not weaken restore approval, retention, or delete controls.
- Preserve existing PostgreSQL target/job/run behavior.
- Leave owner-only coverage inventory source decisions visible; do not invent a canonical inventory source.

## Validation Expectations

Run `npm run build`, `npm test -- --runInBand`, `node --check web/admin/app.js`, and manually inspect changed outputs for secret-safe metadata-only behavior.
