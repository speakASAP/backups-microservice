# EP-BAK-G16: PostgreSQL Backup Execution Repair

```yaml
id: EP-BAK-G16
status: approved-by-user-task
source_goal: implementation-goals/GOAL-16-postgres-execution-repair.md
owner: integration-validator
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: complete
```

## Upstream Traceability

`docs/orchestrator/INTENT.md` requires recoverable PostgreSQL backups without secret exposure. `BAK-G9` intended nightly logical PostgreSQL backups to MinIO, but production runs fail because `wal-g pgbackup` is not a WAL-G 3.0.3 command.

## Goal Impact

Replace both nonexistent commands with supported streaming pipelines: PostgreSQL `pg_dump` custom-format output flows into `wal-g st put`, and approved restore requests flow from `wal-g st cat` into `pg_restore`. Both use direct process argv and never persist raw dump data in the application filesystem.

## Backup Safety Invariants

- No production backup, restore, deletion, deployment, commit, or push.
- Never log or buffer dump stdout.
- Credentials remain environment-only.
- Failed producer or uploader means failed backup run.
- Production restore retains exact run/target/actor/reason approval checks.
- Restore binary bytes are streamed and never logged or buffered as text.
- Any retrieval or `pg_restore` failure persists failed request and verification evidence.

## Contract/Schema Impact

No API or database schema change. Successful future runs use a deterministic relative object key beneath the existing job storage prefix.

## Scope

Modify the WAL-G wrapper, backup execution call, runtime image dependencies, and focused tests. Correct directly related intent/status documentation.

## Files To Modify

- `Dockerfile`
- `src/backup/walg-wrapper.service.ts`
- `src/backup/backup.service.ts`
- `src/retention/retention.service.ts`
- `src/retention/retention.module.ts`
- `src/restore/restore.service.ts`
- `src/restore/restore-execution.ts`
- `test/walg-wrapper.service.spec.ts`
- `test/restore-execution.spec.ts`
- `test/retention.service.spec.ts`
- directly related goal/status/validation docs

## Files That Must Not Be Modified

- `BUSINESS.md`
- `wisdom-quotes/**`
- `shared/**`
- production records, schedules, secrets, and backup objects

## Implementation Steps

1. Add PostgreSQL client tools to the runtime image.
2. Build a deterministic logical dump object key.
3. Stream `pg_dump --format=custom --no-owner --no-privileges` to `wal-g st put --read-stdin`.
4. Capture stderr/status only and terminate the peer process on pipeline failure.
5. Record the safe storage path and preserve pending verification evidence.
6. Replace incompatible physical-backup retention with exact logical-object retention that preserves the newest verified backup.
7. Replace `pgbackup-fetch` with `wal-g st cat` streamed into `pg_restore`, preserving the exact approved target contract and auditable failure states.
8. Add focused command/pipeline tests and run repository gates plus an isolated synthetic PostgreSQL round trip.

## Parallel Execution

- PostgreSQL execution repair: ready now; integration/validation owner is this session.
- MinIO bucket execution: blocked as [MISSING: approved independent storage target and isolated restore plan], plus Phase 5 common-root acceptance, disk-space review, and dry-run approval.
- Final integration: dependency-gated on validation; no deployment in scope.
- Shared files: none. Merge order: source/tests, documentation/status, validation report.

## Rollback Plan

Revert the uncommitted working-tree changes. No production state is changed by this task.
