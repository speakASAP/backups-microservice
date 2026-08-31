# CTX-BAK-G16: PostgreSQL Backup Execution Repair

```yaml
id: CTX-BAK-G16
status: reviewed
source_goal: implementation-goals/GOAL-16-postgres-execution-repair.md
owner: integration-validator
created: 2026-08-30
last_updated: 2026-08-30
```

## Current Behavior

Production image `localhost:5000/backups-microservice:a0d1e9f` contains WAL-G 3.0.3. Every inspected scheduled run fails with `unknown command "pgbackup" for "wal-g"`; verification is correctly marked skipped. Restore source also invokes nonexistent `pgbackup-fetch`. The runtime image lacks `pg_dump` and `pg_restore`.

## Target Behavior

Use PostgreSQL 15 client tools for logical dump production and restore. Upload with supported WAL-G `st put --read-stdin`; retrieve the deterministic object with `wal-g st cat` and stream it into `pg_restore` using the exact approved target. Do not expose credentials or dump payloads.

## Constraints

No deployment, manual backup, restore, artifact deletion, production data mutation, wisdom-quotes edit, or shared edit. MinIO bucket targets remain metadata-only in this goal: [MISSING: approved independent storage target and isolated restore plan].

## Validation Expectations

Focused unit tests, full Jest suite, Nest build, Docker tool presence/version checks when safe, and static review of the exact diff.
