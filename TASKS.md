# TASKS.md - backups-microservice

## Active

- No active PostgreSQL execution-repair task. BAK-G16 is deployed and validated.

## Ready Next

- Define numeric RPO/RTO targets with the project owner.
- Design an automated isolated restore-verification runner so successful backup
  runs can move from `pending` to `verified` without restoring over production.

## Blocked

- An approved independent storage target and isolated restore plan for MinIO
  application buckets are not yet available. Do not implement same-cluster copies as
  independent disaster-recovery coverage.

## Completed

- [x] Canonical IPS adoption and orchestration documentation.
- [x] PostgreSQL schema, schedules, logical backup, restore, notification,
  logging, dashboard, retention, audit, and restore-serialization controls.
- [x] BAK-G16 replaced unsupported WAL-G PostgreSQL commands with
  `pg_dump -Fc -> wal-g st put` and `wal-g st cat -> pg_restore`.
- [x] Stream failure handling, exact-object cleanup, retention anchors,
  transaction advisory locks, database-name validation, idempotency, and
  restart reconciliation passed 18 suites / 175 tests.
- [x] Commit `be82d39` deployed Ready `1/1`.
- [x] `/health/restore-readiness` reports ready; required partial unique indexes
  exist and duplicate active restore targets are zero.
- [x] Repaired the missing private `backups` bucket and rotated the stale MinIO
  identity to a dedicated bucket-scoped credential through Vault/ESO.
- [x] Created the `wisdom_quotes` nightly job at `02:15 UTC`.
- [x] Run `6e1db2e6-01d2-4fa1-94a1-bc508ad6bb0b` succeeded, produced a
  `30,561`-byte deterministic object, and restored into a disposable database
  at Alembic revision `8f2a41c7d3b5`; the scratch database was removed.

## Handoff

Read `STATE.json`, `docs/IMPLEMENTATION_STATE.md`, and
`implementation-goals/GOAL-16-postgres-execution-repair.validation.md` before
future backup work. Production restores remain separately approved and must
never target a live database during validation.
