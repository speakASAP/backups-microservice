# GOAL-03: Dashboard Summary API

```yaml
id: BAK-G3
status: done
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Objective

Give the frontend a safe, single source for operational backup state.

## Acceptance Criteria

- `GET /dashboard/summary` returns targets, jobs, recent runs, restore requests, storage settings, and guardrails.
- The endpoint does not expose secret values.
- Protected auth behavior remains consistent with other management endpoints.
- `npm run build` passes.

## Evidence

Tracked as complete in `TASKS.md` and `STATE.json`. Future sessions should run build/tests before relying on this endpoint.
