# GOAL-02: Operator Dashboard Frontend

```yaml
id: BAK-G2
status: done
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Objective

Give operators a clear UI for services/sources, schedules, retention, backup history, restore history, and settings.

## Acceptance Criteria

- Dashboard shows target coverage, enabled jobs, recent runs, failed runs, latest success, storage backend, retention guardrails, and restore safety.
- Jobs page shows source database, schedule, retention, storage prefix, last run, and enabled state.
- New job creation uses a target dropdown rather than requiring raw target UUID entry.
- Restore page uses target selection and keeps destructive warnings visible.
- The UI handles unauthenticated API responses clearly.

## Evidence

Tracked as complete in `TASKS.md` and `STATE.json`. Future sessions should validate the current frontend before extending it.
