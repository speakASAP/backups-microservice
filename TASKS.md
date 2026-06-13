# TASKS.md — backups-microservice

## Backlog

- [x] Add backup intent preservation docs and goal sequence
- [x] Add Goalkeeper-style master orchestrator, implementation state, goal index, templates, and next-goal script
- [x] Add IPS compliance docs, project invariants, and Goal 04 pre-coding artifacts
- [x] Add dashboard summary API for backup management UI
- [x] Frontend dashboard (backup history, health, alerts)
- [ ] Create PostgreSQL schema `backups` with migrations
- [ ] Implement BackupsModule: pg_dump to MinIO nightly
- [ ] Implement SchedulesModule: configurable cron policies
- [ ] Implement RestoresModule: restore from MinIO + verify
- [ ] Add NotificationsModule integration (success/failure)
- [ ] Add LoggingModule integration
- [x] Implement restore verification state and evidence
- [x] Add coverage model for service owner, RPO/RTO, source type, and criticality
- [x] Harden retention, backup-run deletion, and production restore approval controls
- [x] Production readiness review

## Orchestrated Next Action

- [x] `BAK-G6` Safety and audit controls for retention, deletion, and production restore approval
- [x] `BAK-G7` Production readiness and smoke tests

- [x] Owner review and deployment approval
- [x] Automate additive schema readiness before service startup
