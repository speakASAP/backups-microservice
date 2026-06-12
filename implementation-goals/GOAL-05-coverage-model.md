# GOAL-05: Ecosystem Coverage Model

```yaml
id: BAK-G5
status: ready
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Objective

Move from database-only configuration toward full microservice backup coverage.

## Acceptance Criteria

- Target/source model can identify service owner, source category, criticality, RPO/RTO, and restore class.
- PostgreSQL behavior remains backward compatible.
- MinIO bucket, Kubernetes resource, secret, and PVC targets have documented contracts before implementation.
- Dashboard shows protected and unprotected configured services.

## Non-Goals

- Do not implement unsafe backup mechanisms for Vault secrets or TLS private keys.
- Do not break existing PostgreSQL target/job/run records.
- Do not make Backups own application-domain data.

## Files To Inspect

```text
src/targets/entities/backup-target.entity.ts
src/jobs/entities/backup-job.entity.ts
src/dashboard/dashboard.service.ts
src/migrations/
web/admin/app.js
docs/orchestrator/backup-intent-plan.md
```

## Validation Plan

- Run `npm run build`.
- Run relevant tests.
- Verify migration/backward compatibility plan before schema changes.
