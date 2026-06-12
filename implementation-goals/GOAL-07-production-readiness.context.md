# CTX-BAK-G7: Production Readiness And Smoke Tests

```yaml
id: CTX-BAK-G7
status: active
source_goal: implementation-goals/GOAL-07-production-readiness.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Purpose

Provide implementation context for production readiness checks that verify Backups after deploy without triggering destructive operations or exposing secrets.

## Required Reading

- `AGENTS.md`
- `docs/orchestrator/INTENT.md`
- `docs/orchestrator/backup-intent-plan.md`
- `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- `docs/process/PROJECT_INVARIANTS.md`
- `docs/process/OPERATIONAL_GATES.md`
- `implementation-goals/GOAL-07-production-readiness.md`
- `scripts/deploy.sh`
- `src/health/health.controller.ts`
- `src/info/info.controller.ts`
- `src/dashboard/dashboard.controller.ts`
- `k8s/deployment.yaml`

## Relevant Contracts

- `GET /health` is public liveness and must remain safe for Kubernetes liveness checks.
- `GET /health/readiness` is public readiness and must report database and storage readiness separately.
- `GET /info` is public service metadata.
- Management endpoints remain protected by `JwtRolesGuard`; unauthenticated smoke checks must reject with 401/403.
- Authenticated smoke checks may use an environment-supplied token but must not print it.
- Smoke tests must be read-only: health, info, dashboard summary, jobs, targets, recent runs.

## Current Behavior

- `/health` only reports static service status.
- Kubernetes readiness probe currently points to `/health`.
- `scripts/deploy.sh` performs a simple in-pod `/health` fetch after rollout.
- The deploy script does not verify management endpoint protection or dashboard/jobs/targets/recent-runs availability.

## Target Behavior

- Health/readiness responses include separate database and storage readiness checks.
- Kubernetes readiness uses `/health/readiness`.
- Deploy runs a meaningful non-destructive smoke check after rollout.
- Smoke output summarizes pass/fail status without dumping API bodies or secret material.

## Constraints

- Do not deploy without owner approval.
- Do not trigger backup deletion or restore.
- Do not require secret values in local test output.
- Keep storage readiness based on safe metadata/configuration, not printed credentials.

## Validation Expectations

- `npm run build` passes.
- `npm test -- --runInBand` passes.
- `node --check scripts/smoke-check.js` passes.
- `git diff --check` passes.
- Production smoke is documented as not run unless owner approves deployment/target checks.
