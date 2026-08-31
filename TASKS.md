# TASKS.md — backups-microservice

## Active

- Canonical IPS adoption bootstrap completed and validated.

## Ready Next

- Project owner definition of numeric RPO/RTO targets is needed before those become operational acceptance criteria.

## Blocked

- Executable MinIO bucket backup requires an approved independent storage target, isolated restore plan, Phase 5 common-root acceptance, disk-space review, and non-delete dry run.

## Completed

- Canonical IPS adoption consolidates and cross-references established intent, invariants, and validation-debt history.

## Handoff

Read `STATE.json`, `docs/IMPLEMENTATION_STATE.md`, and `docs/orchestrator/INTENT.md` before continuing. The detailed BAK-G16 record below remains the implementation handoff.

## Backlog

- [x] Add backup intent preservation docs and goal sequence
- [x] Add Goalkeeper-style master orchestrator, implementation state, goal index, templates, and next-goal script
- [x] Add IPS compliance docs, project invariants, and Goal 04 pre-coding artifacts
- [x] Add dashboard summary API for backup management UI
- [x] Frontend dashboard (backup history, health, alerts)
- [x] Create PostgreSQL schema `backups` with migrations
- [x] Implement BackupsModule: pg_dump to MinIO nightly
- [x] Implement SchedulesModule: configurable cron policies
- [x] Implement RestoresModule: restore from MinIO + verify
- [x] Add NotificationsModule integration (success/failure)
- [x] Add LoggingModule integration
- [x] Implement restore verification state and evidence
- [x] Add coverage model for service owner, RPO/RTO, source type, and criticality
- [x] Harden retention, backup-run deletion, and production restore approval controls
- [x] Production readiness review

## Orchestrated Next Action

- [x] `BAK-G6` Safety and audit controls for retention, deletion, and production restore approval
- [x] `BAK-G7` Production readiness and smoke tests

- [x] Owner review and deployment approval
- [x] Automate additive schema readiness before service startup

- [x] Deploy PostgreSQL schema namespace move after owner approval

- [x] Deploy default nightly PostgreSQL backup bootstrap after owner approval

- [x] Deploy configurable schedule policies after owner approval

- [x] Deploy restore verification hardening after owner approval
- [x] Revalidate `BAK-G4` restore verification evidence on `main` after owner request
- [x] Select or define the next roadmap goal (`BAK-G14`) before further implementation
- [x] `BAK-G14` Show sanitized database and Vault durability evidence in the frontend
- [x] `BAK-G15` Show the sanitized Phase 0 disaster-recovery catalog in the frontend

## Project Completion Marker

- 2026-06-21: Project marked completed/frozen after remote inventory. There are no active goals, active plans, open tasks, blockers, or pending human/AI actions. Do not ask for a new goal during routine status checks unless the owner explicitly creates one.
- 2026-06-25: BAK-G14 fully closed after the parallel Vault worker delivered `/home/ssf/Documents/Github/shared/runtime-evidence/vault-backups/latest.json`; sanitized database and Vault durability evidence are both live, and the project returns to completed/frozen with no open tasks.
- 2026-06-25: BAK-G15 implementation completed on `codex/backups-phase1-catalog-support`; deployment remains pending owner approval before the live dashboard displays the Phase 0 DR catalog.

- 2026-06-25: BAK-G15 deployed and authenticated-smoke validated on image `localhost:5000/backups-microservice:5365c98f`. Live `/dashboard/summary` returns disaster recovery catalog status `success`, 12 payload families, 5 missing lanes, and no `.backup-secret` path exposure.


## BAK-G16 PostgreSQL Execution Repair (2026-08-30)

- [x] Diagnose production nightly failures without exposing secrets or backup contents.
- [x] Replace unsupported `wal-g pgbackup` execution with `pg_dump` streamed to supported WAL-G object storage upload.
- [x] Add verified-backup-aware logical object retention and focused tests.
- [x] Build a validation image and verify PostgreSQL 15 client tools plus WAL-G 3.0.3 storage commands.
- [ ] Owner-reviewed commit and deployment; intentionally not performed in this task.
- [ ] After deployment, verify one scheduled or separately approved manual run and confirm MinIO object evidence plus pending/verified restore state.
- [x] Replace unsupported `pgbackup-fetch` restore execution with deterministic `wal-g st cat` retrieval streamed into `pg_restore`; validate against isolated synthetic PostgreSQL only.
## BAK-G16 HIGH review-blocker repair (2026-08-31)

- [x] Stream errors and premature closes now force a nonzero backup/restore pipeline and terminate both children; a failed upload's partial object at the run's own deterministic key is discarded.
- [x] Retention deletes only the exact deterministic `logical/<run-id>.dump`, never a prefix, folder, or rewritten path.
- [x] A null or non-deterministic `storage_path` can no longer act as the verified retention safety anchor.
- [x] Objects referenced by a pending or running restore request, or by an in-flight `verifying` source, are pinned against retention.
- [x] `database_name` is strictly validated at both the DTO and execution boundaries; URI, `key=value`, option-like, whitespace, and control-character values are rejected.
- [x] Per-target restore serialization and duplicate-submission protection are enforced by two database unique indexes plus a conditional pending-to-running claim.
- [ ] Owner-reviewed commit and deployment; intentionally not performed in this task.

## BAK-G16 second HIGH review round (2026-08-31)

- [x] Retention and restore share one transaction-scoped PostgreSQL advisory lock keyed by backup run; retention rechecks active restore and `verifying` state while holding it, immediately before the delete decision.
- [x] A lock wait that times out defers cleanup and refuses restore acceptance; it is never read as "safe to delete".
- [x] The verified retention safety anchor must be proven present and readable in object storage by an exact-object `wal-g st ls <folder>` probe before any deletion; `absent` or `unknown` defers the whole pass, and the dump is never downloaded.
- [x] Restores fail closed with 503 when `uq_restore_requests_active_target` is missing, blocked by duplicates, or unverifiable, exposed as `GET /health/restore-readiness`, reported informationally on the Kubernetes readiness probe, with optional hard startup failure via `BACKUPS_FAIL_START_WITHOUT_RESTORE_SERIALIZATION=true`.
- [x] Request row and audit event are persisted in one locked transaction, and terminal state plus its audit event are written atomically, so an audit failure cannot strand a target or lose auditability.
- [x] `RestoreReconciliationService` re-dispatches adoptable PENDING requests through the same atomic claim after a restart and terminally fails abandoned PENDING or stale RUNNING requests; an interrupted RUNNING restore is never re-executed.
- [x] Race, storage-proof, degraded-schema, and restart tests added; full suite 18 suites / 175 tests.
- [ ] Owner-reviewed commit and deployment; intentionally not performed in this task.
- [ ] After deployment, check `GET /health/restore-readiness` to confirm the production catalog allowed the serialization index to install.

- [ ] Implement executable MinIO bucket backup only after approved independent storage target and isolated restore plan, Phase 5 common-root acceptance, disk-space review, and non-delete dry run. The `wisdom-quotes MinIO bucket` target is already registered as contract-only coverage metadata.
