# TASKS.md — backups-microservice

## Backlog

- [x] Add backup intent preservation docs and goal sequence
- [x] Add dashboard summary API for backup management UI
- [x] Frontend dashboard (backup history, health, alerts)
- [ ] Create PostgreSQL schema `backups` with migrations
- [ ] Implement BackupsModule: pg_dump to MinIO nightly
- [ ] Implement SchedulesModule: configurable cron policies
- [ ] Implement RestoresModule: restore from MinIO + verify
- [ ] Add NotificationsModule integration (success/failure)
- [ ] Add LoggingModule integration
- [ ] Implement restore verification state and evidence
- [ ] Add coverage model for service owner, RPO/RTO, source type, and criticality
- [ ] Harden retention, backup-run deletion, and production restore approval controls
- [ ] Production readiness review
