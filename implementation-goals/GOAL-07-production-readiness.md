# GOAL-07: Production Readiness And Smoke Tests

```yaml
id: BAK-G7
status: done
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-13
```

## Objective

Make backup operations verifiable after each deploy.

## Acceptance Criteria

- Smoke test covers health, info, protected endpoint rejection, dashboard summary, jobs, targets, and recent runs.
- Health/readiness reports database and storage readiness separately.
- Deploy script runs a meaningful post-rollout backup service smoke check.
- Evidence log is updated after each implementation cycle.

## Non-Goals

- Do not deploy to production without owner approval.
- Do not run destructive backup deletion or production restore in smoke tests.
- Do not require secret values in local test output.

## Files To Inspect

```text
scripts/deploy.sh
src/health/health.controller.ts
src/info/info.controller.ts
src/dashboard/dashboard.controller.ts
k8s/
docs/IMPLEMENTATION_STATE.md
```

## Validation Plan

- Run local build/tests.
- Run non-destructive HTTP smoke checks against approved target.
- Record deployment evidence only after owner approval.
