# GOAL-10: Configurable Cron Schedule Policies

```yaml
id: BAK-G10
status: done
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```

## Objective

Make backup schedules configurable through explicit schedule policies while preserving custom cron support.

## Acceptance Criteria

- Jobs support `hourly`, `daily`, `weekly`, and `custom_cron` policies.
- Schedule policy fields normalize to the existing `schedule_cron` execution path.
- Invalid schedule policies, invalid UTC hour/minute/day values, and invalid cron expressions are rejected.
- Existing custom cron jobs remain compatible.
- Schema readiness adds policy fields idempotently.

## Non-Goals

- Do not trigger a backup during implementation.
- Do not delete backup runs or artifacts.
- Do not perform restore.
- Do not expose secret values.

## Validation Plan

- Run `npm run build`.
- Run `npm test -- --runInBand`.
- Run `bash -n scripts/smoke-test.sh` and `git diff --check`.
