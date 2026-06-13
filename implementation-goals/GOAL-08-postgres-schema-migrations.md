# GOAL-08: PostgreSQL Schema Namespace And Migrations

```yaml
id: BAK-G8
status: implemented-not-deployed
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```

## Objective

Create a dedicated PostgreSQL schema namespace for Backups tables and make migrations/schema readiness schema-aware.

## Acceptance Criteria

- Runtime database schema is configurable through `DB_SCHEMA` and defaults to `backups`.
- TypeORM application and migration data sources use the configured schema.
- Startup schema readiness creates the schema and moves legacy `public` tables into it idempotently.
- Migration tooling can show/run migrations against the configured schema.
- No destructive schema operations are introduced.

## Non-Goals

- Do not delete backup data.
- Do not perform production restore or backup-run deletion.
- Do not expose database credentials or generated tokens.
- Do not deploy the namespace move without explicit owner approval.

## Files To Inspect

```text
src/app.module.ts
src/data-source.ts
src/schema/schema-readiness.service.ts
src/migrations/
k8s/configmap.yaml
package.json
```

## Validation Plan

- Run `npm run build`.
- Run `npm test -- --runInBand`.
- Run `bash -n scripts/smoke-test.sh` and `git diff --check`.
- Review generated schema readiness SQL for destructive statements.
