# GOAL-05: Ecosystem Coverage Model

```yaml
id: BAK-G5
status: done
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-13
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

- Added/verified coverage metadata fields and migration for backup targets: service owner, source category, criticality, RPO/RTO, restore class, Kubernetes namespace, and coverage notes.
- Preserved PostgreSQL defaults for existing targets and kept executable WAL-G jobs limited to `postgres_database`.
- Dashboard summary exposes coverage stats, source contracts, and discovered unprotected sources without exposing secrets or backup artifact paths.
- Admin dashboard shows coverage classes, source contracts, configured target metadata, and discovered unprotected sources; contract-only categories cannot create executable schedules from the UI.
- Added focused enum tests for target/source coverage contracts.
- Narrowed `.gitignore` backup patterns so active backup source and test files are visible to Git.

Validation:

- `npm run build` passed.
- `npm test -- --runInBand` passed with 3 suites and 8 tests.
- `node --check web/admin/app.js` passed.
- `git diff --check` passed.
- Changed-file secret/safety scan found only policy text and safe reference strings, not secret values.
