# CP-BAK-G8: PostgreSQL Schema Namespace And Migrations

```yaml
id: CP-BAK-G8
status: complete
source_goal: implementation-goals/GOAL-08-postgres-schema-migrations.md
source_plan: implementation-goals/GOAL-08-postgres-schema-migrations.execution-plan.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```

## Assignment

Implement schema-aware Backups persistence so PostgreSQL tables live under a configurable `DB_SCHEMA`, defaulting to `backups`.

## Scope

Allowed files: TypeORM config, data source, schema-readiness service/tests, initial migration schema creation, Kubernetes config, package migration scripts, state docs.

## Non-Goals

Do not delete data, restore production, delete backup runs, or expose secrets.

## Validation Required

Run build, full Jest, smoke script syntax, and diff hygiene.
