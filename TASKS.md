# TASKS.md — backups-microservice

## Backlog

- [ ] Create PostgreSQL schema `backups` with migrations
- [ ] Implement BackupsModule: pg_dump to MinIO nightly
- [ ] Implement SchedulesModule: configurable cron policies
- [ ] Implement RestoresModule: restore from MinIO + verify
- [ ] Add NotificationsModule integration (success/failure)
- [ ] Add LoggingModule integration
- [ ] Frontend dashboard (backup history, health, alerts)
- [ ] Production readiness review
