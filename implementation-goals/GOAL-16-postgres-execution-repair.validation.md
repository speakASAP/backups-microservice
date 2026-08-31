# VAL-BAK-G16: PostgreSQL Backup Execution Repair

```yaml
id: VAL-BAK-G16
status: passed-source-awaiting-deployment
validated_artifact: implementation-goals/GOAL-16-postgres-execution-repair.md
owner: integration-validator
created: 2026-08-30
last_updated: 2026-08-31
```

## Root Cause Evidence

Production image `localhost:5000/backups-microservice:a0d1e9f` runs WAL-G 3.0.3. Runtime `wal-g --help` has supported `st put`/`st cat` commands but no `pgbackup` or `pgbackup-fetch`. Production backup-run metadata from 2026-08-11 through 2026-08-30 contains the `pgbackup` error and verification status `skipped`. The deployed image also has no `pg_dump` or `pg_restore`.

## Implemented

- Installed PostgreSQL client tools in the runtime image.
- Replaced the nonexistent command with streaming `pg_dump --format=custom --no-owner --no-privileges --no-password` into `wal-g st put --read-stdin`.
- Added deterministic, validated object names and records the storage path only after both processes succeed.
- Prevented binary dump stdout from entering logs or in-memory diagnostic output.
- Replaced physical-WAL retention invocation with exact logical-object retention derived from successful run metadata; cleanup is deferred until a verified backup exists and preserves the newest verified run.
- Replaced `pgbackup-fetch` with `wal-g st cat` streamed directly into `pg_restore --clean --if-exists --exit-on-error --single-transaction` for the exact approved PostgreSQL target.
- Added deterministic storage-path validation, PostgreSQL-only target enforcement, direct argv execution without a shell, and persisted failure/audit state for retrieval, validation, and restore failures.

## Gate Evidence

- Baseline: 13 suites / 49 tests passed; build passed.
- Focused: 2 suites / 7 tests passed after implementation.
- Full: 15 suites / 60 tests passed; build, admin JavaScript syntax, smoke script syntax, and `git diff --check` passed.
- Validation image built successfully under the ecosystem deploy lock. It contains PostgreSQL client 15.19 (matching production PostgreSQL 15.19), WAL-G 3.0.3, and supported `wal-g st put`.
- A synthetic, non-sensitive file-storage round trip proved `wal-g st put --read-stdin --no-compress <object>` writes the intended object name and `wal-g st cat <object>` returns identical bytes.
- A separate isolated PostgreSQL 15 container round trip created synthetic data, streamed `pg_dump` through WAL-G storage, streamed `wal-g st cat` into the exact `pg_restore` command, and verified the restored synthetic row. No production database, bucket, backup record, or restore request was touched. All containers, network, scratch files, and the validation image were removed.
- ESLint was attempted but no repository ESLint configuration exists; recorded as VD-002.

## MinIO Bucket Coverage

The production catalog already contains `wisdom-quotes PostgreSQL` and `wisdom-quotes MinIO bucket` targets. Only PostgreSQL jobs are executable. MinIO bucket execution remains contract-only: [MISSING: approved independent storage target and isolated restore plan]. Phase 5 also requires common-root acceptance, disk-space review, and a non-delete copy dry run. No unsafe same-MinIO copy implementation was added.

## HIGH Review-Blocker Repair (2026-08-31)

Six HIGH review blockers were raised against the uncommitted BAK-G16 change set. All six are implemented and validated. `pg_dump -> wal-g st put` and `wal-g st cat -> pg_restore` are preserved unchanged.

1. **Stream failure is now terminal.** Both pipelines run through `stream.pipeline`. Any stream error or premature close sets a failure flag, terminates both children with `SIGTERM` and a `SIGKILL` escalation, and forces a nonzero result even when both processes report exit code 0. The success marker is only appended when no stream failure occurred. A failed upload can leave a truncated object at the run's own deterministic key, so the pipeline now removes exactly that key on failure; the key is never recorded as a storage path, so no retained backup can be affected.
2. **Retention deletes exact objects only.** The object name is derived deterministically from the run ID, and the recorded `storage_path` must be byte-identical to the path this job would have written. `deleteLogicalObject` additionally pattern-checks `logical/<uuid>.dump` before `wal-g st rm` runs, so a prefix, folder, glob, traversal, or partially formed key is refused before any process is spawned.
3. **Safety anchors must be intact.** A verified run whose `storage_path` is null, blank, foreign, or non-deterministic can no longer act as the retention safety anchor; cleanup defers instead.
4. **Referenced objects are pinned.** Runs referenced by a `pending` or `running` restore request, and runs whose `verification_status` is `verifying`, are skipped by retention and logged as `retention.cleanup.object_pinned`.
5. **`database_name` is strictly validated.** A shared validator rejects connection URIs, `key=value` syntax, option-like values, path separators, whitespace, control characters, empty values, and values over 63 characters at the create/update DTO boundary, in `TargetsService`, in `assertPostgresRestoreTarget`, and in `WalgWrapperService.buildEnv`/`restoreFromObject`. All nine existing catalog names remain accepted.
6. **Restore serialization is database-enforced.** `uq_restore_requests_active_target` is a partial unique index on `target_id` where `status IN ('pending','running')`; `uq_restore_requests_idempotency_key` makes duplicate submissions return the original request instead of creating a second one. Execution claims a request with a single conditional `pending -> running` UPDATE, so a re-entered execution cannot run the same restore twice. Both indexes and the `idempotency_key` column are created by migration `1748563700000-RestoreSerializationControls` and by the additive startup schema-readiness path, which defers the serialization index with a warning instead of failing startup if a catalog already holds duplicates.

## Repair Gate Evidence

- Full Jest suite: 16 suites / 118 tests passed, including new reproductions for every review finding and concurrency cases for duplicate submission and same-target races.
- `nest build` and `./node_modules/.bin/tsc --noEmit` passed.
- `git diff --check`, JSON parse of all repository JSON, `node --check web/admin/app.js`, and `bash -n scripts/*.sh` passed.
- Validation image rebuilt under the ecosystem deploy lock: PostgreSQL client 15.19, WAL-G 3.0.3, supported `wal-g st put`.
- Synthetic round trip executed the compiled `WalgWrapperService` against an isolated PostgreSQL 15 container and synthetic WAL-G file storage: 34 of 34 checks passed. It proved the successful dump/upload/retrieve/restore round trip with a matching restored row, no archive bytes in diagnostic output, nonzero results for producer failure, unwritable destination, and missing object, no partial object left behind, refusal of all six unsafe deletion names with the prefix and object left intact, exact-object deletion succeeding with the prefix surviving, and refusal of an unsafe restore target database.
- Migration chain applied cleanly to an isolated PostgreSQL 15 database. Direct SQL proved a second `pending` and a `running` restore for the same target are rejected by `uq_restore_requests_active_target`, a duplicate idempotency key is rejected by `uq_restore_requests_idempotency_key`, terminal statuses free the serialization slot, and NULL idempotency keys stay distinct.
- The startup schema-readiness path was applied twice for idempotency, created both indexes, enforced per-target serialization, and survived a deliberately degraded catalog by deferring the index with a warning.
- No production host, database, bucket, backup record, restore request, or deployment was touched. All validation containers, the network, the pulled `postgres:15` image, the validation image, and every scratch file were removed.

## Second HIGH Review Round: Race, Storage Proof, Fail-Closed Schema, Stranded Restores (2026-08-31)

Four remaining HIGH findings were repaired. Every fix is fail-closed: uncertainty defers or refuses, it never deletes and never executes.

### 1. Retention/restore race is closed by one shared lock keyed by backup run

`BackupRunLockService.withBackupRunLock(runId, work)` (`src/common/backup-run-lock.service.ts`) opens a transaction, sets a bounded `lock_timeout`, takes `pg_advisory_xact_lock(0x424b5231, sha256(runId)[0..4))`, and runs the caller inside it. The lock is transaction scoped, so commit, rollback, connection loss, or process death release it; no lease can survive a restart.

Both sides of the race now take the same lock for the same run:

- `RestoreService.createPin()` re-reads the run, re-checks idempotency, re-checks the per-target active constraint, inserts the request, and writes its audit event in one locked transaction.
- `RestoreService.claimForExecution()` performs the conditional `pending -> running` claim and marks the run `VERIFYING` in the same locked transaction, so a claimed restore is a visible pin before execution starts.
- `RetentionService.deleteExpiredObject()` re-reads the run and counts active restore requests **while holding the lock**, immediately before the delete decision, and clears `storage_path` in the same transaction. A run that acquired a pin after the candidate scan is skipped with `object_pinned` / `recheck: 'locked'`.
- A lock wait that times out is never treated as "safe to delete": retention logs `retention.cleanup.lock_unavailable` and defers, restore logs `restore.request.lock_unavailable` and refuses.

### 2. The verified safety anchor must be proven present in object storage before any deletion

`WalgWrapperService.probeLogicalObject(env, objectName)` lists only the object's own folder with `wal-g st ls <folder>` - never recursive, never a glob - and accepts a row only when its type is `obj`, its name is byte-identical to the object's leaf, and its size parses as a positive number. A failed listing, a missing match, a duplicate match, a folder row, or an unusable size resolves to `absent` or `unknown`. The dump is never downloaded.

`RetentionService.anchorIsProven()` runs this probe against the chosen verified anchor before any expired object is deleted. Only a `present` anchor unlocks cleanup (`retention.cleanup.anchor_verified`); `absent` or `unknown` defers the entire cleanup pass.

### 3. Restores fail closed when the database cannot serialize them

`buildRestoreSerializationCheckSql()` reads `uq_restore_requests_active_target` from `pg_class` and counts targets holding more than one active request. `SchemaReadinessService` starts **unready by design** and runs this proof on every `apply()`, including when `BACKUPS_APPLY_SCHEMA_READINESS=false`, because the additive path only creates the index when the catalog is already clean.

- `RestoreService.create()` calls `assertRestoreSerializationReady()` first, so destructive restore traffic is refused with 503 whenever the index is missing, blocked by duplicates, or unverifiable.
- `GET /health/restore-readiness` returns 503 with the exact reason while degraded.
- `GET /health/readiness` reports `restore_serialization` informationally with `blocks_pod_readiness: false`. It is the Kubernetes readiness probe, and flipping it would evict the pod from Service endpoints and stop scheduled backups - a degraded restore path must not take backups down.
- `BACKUPS_FAIL_START_WITHOUT_RESTORE_SERIALIZATION=true` converts the degraded state into a startup failure for operators who prefer a hard stop.

### 4. Stranded PENDING/RUNNING restores cannot permanently block a target

- Request row and audit event are written in one locked transaction (`AuditService.record` accepts the caller's `EntityManager`), so an audit failure can no longer leave an accepted request without its audit trail, or a pinned target without a request.
- `persistTerminalState()` writes terminal status and its audit event atomically under the run lock, guarded by a terminal re-read, so a terminal state is recorded once.
- `RestoreReconciliationService` runs every 60s and after restart: a PENDING request older than `RESTORE_PENDING_ADOPT_MS` that no process is executing is re-dispatched through the same atomic `pending -> running` claim; one older than `RESTORE_PENDING_ABANDON_MS` is failed terminally; a RUNNING request older than `RESTORE_RUNNING_STALE_MS` with no in-process owner is failed terminally with audit and notification.
- An interrupted RUNNING restore is **never** re-executed. `pg_restore` runs `--single-transaction`, so an interrupted attempt already rolled back; recovery requires a new approved request with a new idempotency key. Only PENDING work is re-dispatched, and only through the conditional claim, so a destructive restore can never execute twice.

### Files

New: `src/common/backup-run-lock.service.ts`, `src/common/common.module.ts`, `src/restore/restore-reconciliation.service.ts`, `test/support/run-lock.ts`, `test/backup-run-lock.service.spec.ts`, `test/restore-reconciliation.service.spec.ts`.

Modified: `src/backup/walg-wrapper.service.ts`, `src/retention/retention.service.ts`, `src/retention/retention.module.ts`, `src/restore/restore.service.ts`, `src/restore/restore.module.ts`, `src/schema/schema-readiness.service.ts`, `src/audit/audit.service.ts`, `src/health/health.controller.ts`, `src/health/health.module.ts`, `src/app.module.ts`, `test/retention.service.spec.ts`, `test/restore.service.spec.ts`, `test/walg-wrapper.service.spec.ts`, `test/schema-readiness.service.spec.ts`, `test/health.controller.spec.ts`.

### Second Round Gate Evidence

- Full Jest suite: 18 suites / 175 tests passed, including retention/restore race interleavings under a serializing fake lock, exact-object probe parsing, degraded-schema 503 behaviour, and restart/stranded-request reconciliation.
- `nest build`, `./node_modules/.bin/tsc --noEmit -p tsconfig.json`, `git diff --check`, JSON parse of all 8 tracked JSON files, `node --check web/admin/app.js`, and `bash -n scripts/*.sh` all passed.
- Validation image rebuilt from the repository Dockerfile under `shared/scripts/with-deploy-lock.sh`.
- Isolated synthetic round trip: **27 of 27 checks passed** against an isolated PostgreSQL 15 container and an isolated MinIO S3 backend on a private Docker network, using the compiled service code.
  - Storage: probe absent before upload, present with a positive size after upload, no dump bytes in probe output (221 bytes), sibling objects in the same folder never satisfy a different key, all six unsafe object names refused as `unknown`, unreachable storage resolves to `unknown` rather than `absent`, exact-object restore reproduced the synthetic row, and exact-object deletion left the neighbouring object intact. This also confirmed the `wal-g st ls` row format on a real S3-compatible backend, not only on file storage.
  - Lock: keys deterministic per run, two holders of one run lock never overlapped, a bounded wait surfaced `55P03`, different runs did not serialize against each other, and a rolled back holder released the lock immediately.
  - Degraded schema: with duplicate active requests the index was not installed, the state reported one duplicate target, restore traffic was refused with 503, the catalog proof reported `installed=false`, the strict policy refused startup, clearing duplicates installed the index, the database itself rejected a second active restore for the target with `uq_restore_requests_active_target`, and a terminal request freed the slot.
- No production host, database, bucket, backup record, restore request, secret, or deployment was touched. All validation containers, the private network, the validation image, the pulled MinIO image, and every scratch file were removed; the pre-existing `postgres:15-alpine` image was left in place.

## Remaining Blockers

- Production still runs the old image until a separate reviewed commit/deployment.
- No production backup was triggered, so end-to-end MinIO upload evidence must be collected after rollout.
- [UNKNOWN: production catalog cleanliness] Whether the production `restore_requests` catalog currently holds duplicate active requests per target is unverified, so it is unknown whether `uq_restore_requests_active_target` will install on first rollout or whether restores will start in the degraded 503 state. Check `/health/restore-readiness` immediately after deployment.

## Intent Compliance Report

- Goal: repair scheduled PostgreSQL execution without broadening unsafe source support.
- Boundaries: no secrets, raw backup contents, production record mutations, backups, restores, deletions, deployment, commit, push, wisdom-quotes edits, or shared edits.
- Deviation: validation report was finalized after source implementation rather than created as an empty shell before coding; all other required pre-coding artifacts existed first.
- Recommendation: review, commit, and deploy separately; then verify one backup run and retain the existing explicit approval gate for any production restore.
