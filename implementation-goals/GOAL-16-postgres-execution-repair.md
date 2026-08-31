# GOAL-16: PostgreSQL Backup Execution Repair

```yaml
id: BAK-G16
status: deployed-validated
owner: integration-validator
created: 2026-08-30
last_updated: 2026-08-31
```

## Objective

Restore scheduled PostgreSQL logical backup and approved restore execution after
production proved that WAL-G 3.0.3 provides neither `pgbackup` nor
`pgbackup-fetch`.

## Acceptance Criteria

- [x] `pg_dump -Fc` streams to a deterministic WAL-G storage object.
- [x] producer, consumer, stream, and partial-object failures are terminal.
- [x] runtime contains PostgreSQL 15 clients and WAL-G 3.0.3.
- [x] exact-object retention is fail-closed and preserves active restores.
- [x] restore inputs and database names are strictly validated.
- [x] restores are serialized per target and duplicate submissions are idempotent.
- [x] interrupted pending/running requests are reconciled safely.
- [x] deployment `be82d39` is Ready and restore readiness is healthy.
- [x] a production logical backup object and disposable restore were validated.
- [x] MinIO application-bucket backup remains explicit blocked platform debt.

## Non-Goals

- Production restore over a live database.
- Executable MinIO application-bucket backup without an approved independent
  destination and isolated restore plan.
- Changes to unrelated application services.

## Validation Plan

- Focused and full Jest suites, Nest build, TypeScript, syntax, and JSON checks.
- Validation-image tool and isolated PostgreSQL/MinIO round trips.
- Production restore-readiness and index inspection.
- One controlled PostgreSQL backup followed by restore into a disposable
  database and confirmed cleanup.

## Production Evidence

- Image: `localhost:5000/backups-microservice:be82d39`, Ready `1/1`.
- Tests: 18 suites / 175 tests.
- Restore readiness: healthy; zero duplicate active restore targets.
- Job: `Nightly PostgreSQL backup: wisdom_quotes`, `15 2 * * *`.
- Successful run: `6e1db2e6-01d2-4fa1-94a1-bc508ad6bb0b`.
- Object: deterministic key under `s3://backups/wisdom_quotes`, `30,561` bytes.
- Restore: disposable database reproduced revision `8f2a41c7d3b5` and was
  removed; production `wisdom_quotes` was not modified.

## Remaining Debt

`[MISSING: approved independent storage target and isolated restore plan for
MinIO application buckets]`. Automated isolated restore verification also
remains a follow-up; successful runs stay conservatively `pending` until it is
implemented.
