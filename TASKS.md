# TASKS.md — backups-microservice

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
