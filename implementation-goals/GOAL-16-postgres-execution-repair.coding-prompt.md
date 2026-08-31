# CP-BAK-G16: PostgreSQL Backup Execution Repair

```yaml
id: CP-BAK-G16
status: approved-by-user-task
source_goal: implementation-goals/GOAL-16-postgres-execution-repair.md
source_plan: implementation-goals/GOAL-16-postgres-execution-repair.execution-plan.md
owner: integration-validator
created: 2026-08-30
last_updated: 2026-08-30
```

## Assignment

Repair PostgreSQL logical backup and restore execution by replacing unsupported WAL-G `pgbackup`/`pgbackup-fetch` invocations with streaming `pg_dump`/WAL-G storage and WAL-G storage/`pg_restore` pipelines.

## Scope

Change only the runtime dependency installation, WAL-G wrapper, backup/restore call sites, restore path validation helpers, focused tests, and required status/validation documentation.

## Safety Requirements

Do not buffer or log dump stdout. Keep passwords and object-store credentials in environment variables. Treat either process failing as a failed backup or restore, and persist auditable restore failure state. Preserve exact run/target/actor/reason approval checks and use direct argv without a shell. Do not run a production backup, restore, deletion, deploy, commit, or push.

## Validation Required

Run focused tests, full tests, build, diff checks, and safe image/tool checks. Report MinIO bucket execution as blocked unless its separately approved architecture gates are satisfied.
