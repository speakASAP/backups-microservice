# CTX-BAK-G8: PostgreSQL Schema Namespace And Migrations

```yaml
id: CTX-BAK-G8
status: complete
source_goal: implementation-goals/GOAL-08-postgres-schema-migrations.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```

## Purpose

Goal 08 addresses the backlog item to create a PostgreSQL schema namespace for Backups tables and make migrations operate against that namespace.

## Current Behavior

Backups used the `backups` database but tables lived in the default `public` schema. Goal 07 added startup additive schema readiness, but it was not namespace-aware.

## Target Behavior

`DB_SCHEMA` defaults to `backups`; app repositories, migration data source, and schema-readiness SQL use the configured schema. Existing `public` tables are moved into the configured schema only when the target table does not already exist.

## Constraints

No secret exposure, no destructive schema operations, no restore, no backup deletion, and no production deployment without owner approval.

## Validation Expectations

Build, full Jest, shell syntax, diff hygiene, and SQL safety review.
