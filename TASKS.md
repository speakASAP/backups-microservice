# TASKS.md - backups-microservice


# Tasks: backups-microservice

## Active

- [ ] BAK-G16 HIGH-review follow-up is source-validated but uncommitted and undeployed. Review the stream-completion, exact-object deletion, retention pinning, database-name, idempotency, and schema-proof changes before any commit or rollout.


## Ready next

- Define numeric RPO/RTO targets with the project owner.
- Design an automated isolated restore-verification runner so successful backup
  runs can move from `pending` to `verified` without restoring over production.
- Review and commit/deploy the uncommitted BAK-G16 HIGH-review hardening in a separate authorized action.
- Project owner must define numeric RPO/RTO targets before they become operational acceptance criteria.
- Add an automated isolated restore-verification runner; successful backups remain conservatively pending until that lane exists.


## Blocked

- An approved independent storage target and isolated restore plan for MinIO
  application buckets are not yet available. Do not implement same-cluster copies as
  independent disaster-recovery coverage.
- MISSING (unapproved): an independent storage target and isolated restore plan for MinIO application buckets have not yet been approved by the owner.


## Completed


- [x] Canonical IPS adoption and orchestration documentation.
- [x] PostgreSQL schema, schedules, logical backup, restore, notification,
  logging, dashboard, retention, audit, and restore-serialization controls.
- [x] BAK-G16 replaced unsupported WAL-G PostgreSQL commands with
  `pg_dump -Fc -> wal-g st put` and `wal-g st cat -> pg_restore`.
- [x] Initial stream failure handling, exact-object cleanup, retention anchors,
  transaction advisory locks, database-name validation, idempotency, and
  restart reconciliation passed 18 suites / 175 tests in commit `be82d39`.
- [x] HIGH-review follow-up now waits for `stream.pipeline` completion before success, uses exact `st rm --glob` deletion, pins both PENDING and RUNNING restores, validates idempotent replay payloads, and proves both required unique indexes. Current source passes 18 suites / 181 tests.
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
