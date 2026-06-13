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
