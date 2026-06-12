# GOAL-05: Ecosystem Coverage Model

```yaml
id: BAK-G5
status: done
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


## Completion Evidence

Completed on branch `codex/backups-goal-05-coverage-model`.

- Added coverage metadata fields to backup targets: service owner, source category, criticality, RPO/RTO, restore class, Kubernetes namespace, and coverage notes.
- Added additive migration `1748563500000-CoverageModel` with nullable/defaulted columns for backward compatibility.
- Dashboard summary now returns coverage stats and discovered unprotected sources without exposing secrets or backup artifact paths.
- Admin dashboard shows coverage classes, configured target metadata, and discovered unprotected sources; target creation can capture coverage metadata for PostgreSQL sources.
- Documented contracts for MinIO bucket, Kubernetes resource, secret reference, and PVC source classes before implementing those backup engines.

Validation:

- `npm run build` passed.
- `npm test -- --runInBand` passed with 2 suites and 5 tests.
- `node --check web/admin/app.js` passed.
