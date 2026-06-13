# VAL-BAK-G10: Configurable Cron Schedule Policies Validation

```yaml
id: VAL-BAK-G10
status: passed-and-deployed
validated_artifact: implementation-goals/GOAL-10-configurable-schedules.md
owner: validator
created: 2026-06-13
last_updated: 2026-06-13
```

## Evidence

- Added `src/jobs/schedule-policy.ts` with `hourly`, `daily`, `weekly`, and `custom_cron` schedule policy normalization.
- Added schedule policy fields to `BackupJob`, create/update DTOs, initial migration, and startup schema readiness.
- `JobsService.create` and `JobsService.update` normalize schedule policies into `schedule_cron` before persistence.
- `NightlyBackupBootstrapService` now stores its default cron as a `custom_cron` policy.

## Gate Evidence

- `npm run build`: passed.
- `npm test -- --runInBand`: passed with 7 suites and 24 tests.
- `bash -n scripts/smoke-test.sh`: passed.
- `git diff --check`: passed.

## Deployment Evidence

- Production deployment completed on 2026-06-13 as part of the approved combined schema/nightly/schedule/restore rollout. Image `localhost:5000/backups-microservice:fc8c225f` rolled out in namespace `statex-apps`; schedule policy fields are live and full smoke passed.

## Backup Safety Evidence

No backup was triggered. No backup deletion or restore was performed. Schedule changes preserve the existing cron execution path and do not expose secrets.

## Recommendation

Deployed after owner approval with configurable schedule policies live.
