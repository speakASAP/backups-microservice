# VAL-BAK-G8: PostgreSQL Schema Namespace And Migrations Validation

```yaml
id: VAL-BAK-G8
status: passed-not-deployed
validated_artifact: implementation-goals/GOAL-08-postgres-schema-migrations.md
owner: validator
created: 2026-06-13
last_updated: 2026-06-13
```

## Evidence

- Added `src/config/database.ts` for validated schema identifiers and table qualification.
- `src/app.module.ts` and `src/data-source.ts` now use `schema: getDatabaseSchema()`.
- `k8s/configmap.yaml` sets `DB_SCHEMA: backups`.
- `src/schema/schema-readiness.service.ts` creates the configured schema, moves legacy `public` Backups tables if needed, and applies additive columns/tables in the target schema.
- `package.json` has `migration:run` and `migration:show` scripts.
- Initial migration creates the configured schema.

## Gate Evidence

- `npm run build`: passed.
- `npm test -- --runInBand`: passed with 5 suites and 17 tests.
- `bash -n scripts/smoke-test.sh`: passed.
- `git diff --check`: passed.

## Backup Safety Evidence

No destructive schema operation was introduced. SQL safety tests reject `drop`, `truncate`, and `delete`. Table migration uses `ALTER TABLE ... SET SCHEMA`, preserving data in-place.

## Deviations

Production deployment is deferred because moving existing tables from `public` into `backups` is an operational schema namespace change.

## Recommendation

Review and deploy only after owner confirms the namespace move window. Use full smoke after rollout.
