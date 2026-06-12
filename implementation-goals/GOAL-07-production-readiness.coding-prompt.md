# CP-BAK-G7: Production Readiness And Smoke Tests

```yaml
id: CP-BAK-G7
status: active
source_goal: implementation-goals/GOAL-07-production-readiness.md
source_plan: implementation-goals/GOAL-07-production-readiness.execution-plan.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Assignment

Implement BAK-G7 production readiness so each rollout can verify public health/info, readiness, auth protection, dashboard summary, jobs, targets, and recent backup runs.

## Scope

- Add additive `/health/readiness` behavior with database and storage readiness checks.
- Keep `/health` suitable for liveness.
- Add a Node smoke script that performs non-destructive HTTP checks and supports optional bearer auth from environment variables.
- Run the smoke script from `scripts/deploy.sh` after rollout.
- Update Kubernetes readiness probe to `/health/readiness`.
- Add focused tests and update implementation evidence.

## Non-Goals

- Do not deploy to production.
- Do not trigger backups, restores, deletion, or retention changes.
- Do not print bearer tokens, secret keys, passwords, or raw artifact paths.
- Do not weaken endpoint auth to make smoke tests pass.

## Safety Requirements

- Management endpoints must reject unauthenticated requests.
- Production restore remains human-approved and untouched.
- Retention and deletion guardrails from Goal 06 remain intact.
- Health/readiness responses must not expose secret values.

## Implementation Notes

Use TypeORM `DataSource` for a lightweight `SELECT 1` database check. Storage readiness should report WAL-G/MinIO configuration readiness separately from database readiness without connecting in a way that requires exposing credentials. The smoke script should fail if authenticated checks are expected but unavailable in deploy, while local runs without a token may treat protected endpoints as correctly rejected.

## Validation Required

```bash
npm run build
npm test -- --runInBand
node --check scripts/smoke-check.js
git diff --check
```

## Report Required

Return:

- files changed;
- tests/checks run;
- validation evidence;
- risks;
- blockers;
- intent compliance notes.
