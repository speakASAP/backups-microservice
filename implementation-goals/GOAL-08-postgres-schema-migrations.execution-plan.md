# EP-BAK-G8: PostgreSQL Schema Namespace And Migrations

```yaml
id: EP-BAK-G8
status: complete
source_goal: implementation-goals/GOAL-08-postgres-schema-migrations.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
branch: codex/backups-postgres-schema-migrations
```

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Process: `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- Invariants: `docs/process/PROJECT_INVARIANTS.md`
- Backlog item: `Create PostgreSQL schema backups with migrations`

## Goal Impact

This goal makes Backups table ownership explicit in PostgreSQL and prevents future schema drift by making application startup and migration tooling schema-aware.

## Backup Safety Invariants

- BAK-INV-001: Backups owns only backup orchestration tables.
- BAK-INV-003: No secret values in source, prompts, reports, or logs.
- BAK-INV-004: Dashboard/recent-run visibility must keep working after schema selection.
- BAK-INV-009: Implementation includes plan, validation, and state evidence.

## Sensitive-Data Handling

No credentials are added. DB schema names are non-secret operational metadata.

## Contract/Schema Impact

Adds configurable `DB_SCHEMA`, defaults to `backups`, and idempotently moves legacy `public` Backups tables into that schema on startup. This is non-destructive but production deployment should be owner-approved because table namespace changes affect runtime access.

## Scope

- Add DB schema helper.
- Configure TypeORM app/data-source schema.
- Make schema-readiness SQL schema-qualified and legacy-public aware.
- Add migration scripts.
- Update Kubernetes config and tests.

## Non-Goals

- No destructive data migration.
- No deployment in this implementation step.
- No backup trigger, delete, or restore.

## Validation

- `npm run build`: passed.
- `npm test -- --runInBand`: passed with 5 suites and 17 tests.
- `bash -n scripts/smoke-test.sh`: passed.
- `git diff --check`: passed.

## Completion Checklist

- [x] Implementation complete
- [x] Tests complete
- [x] Validation evidence collected
- [x] Documentation updated
- [x] Deployment deferred for owner approval
