# GOAL-16: PostgreSQL Backup Execution Repair

```yaml
id: BAK-G16
status: implemented-awaiting-deployment
owner: integration-validator
created: 2026-08-30
last_updated: 2026-08-31
```

## Objective

Restore scheduled PostgreSQL logical backup and approved restore execution after production proved that WAL-G 3.0.3 provides neither the advertised `pgbackup` nor `pgbackup-fetch` commands.

## Acceptance Criteria

- PostgreSQL logical dumps are produced with `pg_dump` and streamed to the configured MinIO prefix through supported WAL-G storage commands.
- A dump failure or upload failure marks the run failed; binary dump content is never logged or buffered as text.
- Runtime image contains compatible PostgreSQL client tools and WAL-G.
- Existing schedules, target/job schema, auth, secrets, and public response redaction remain unchanged.
- Retention uses exact logical object keys and does not delete while no verified backup with an intact deterministic object exists.
- Retention never deletes an object referenced by a pending or running restore request or by an in-flight verification.
- A stream error or premature close fails the backup or restore pipeline and terminates both children.
- `database_name` is strictly validated at the DTO and execution boundaries.
- Restores are serialized per target and duplicate submissions are idempotent, both enforced by the database.
- Approved PostgreSQL restores stream the deterministic object through supported `wal-g st cat` into `pg_restore` with direct argv execution and exact target settings.
- Restore process, validation, or metadata failures persist failed request and verification evidence.
- MinIO bucket sources remain contract-only unless their separate approved execution lane is unblocked.

## Non-Goals

- No deployment, production backup trigger, restore, backup deletion, or production record mutation.
- No executable MinIO bucket snapshot lane in this goal: [MISSING: approved independent storage target and isolated restore plan].
- No change to wisdom-quotes or shared.

## Validation Plan

- Focused WAL-G wrapper tests.
- Full Jest suite and Nest build.
- Docker image build and tool-version checks if the ecosystem deploy lock is available.
- Static secret/safety scan and `git diff --check`.
