# VAL-BAK-G7: Production Readiness And Smoke Tests

```yaml
id: VAL-BAK-G7
status: passed
validated_artifact: implementation-goals/GOAL-07-production-readiness.md
owner: validator
created: 2026-06-12
last_updated: 2026-06-12
```

## Artifact Validated

BAK-G7 production readiness in remote worktree `/home/ssf/Documents/Github/backups-microservice-goal06` on branch `codex/backups-goal-06-safety-audit-controls`.

## Validation Scope

Validated additive health/readiness API behavior, post-rollout smoke-test coverage, Kubernetes readiness probe configuration, deploy-script smoke hook, and secret-safe non-destructive smoke behavior.

## Evidence

- `GET /health` now returns liveness plus separate readiness check summaries.
- `GET /health/readiness` reports database and storage readiness separately and returns HTTP 503 when not ready.
- `scripts/smoke-check.js` covers health, readiness, info, unauthenticated protected endpoint rejection, dashboard summary, jobs, targets, and recent runs.
- `scripts/deploy.sh` runs the smoke script in the rolled-out pod after rollout with an in-pod token reference only.
- `k8s/deployment.yaml` readiness probe now targets `/health/readiness`.
- Production deployment and production smoke evidence were not run because owner approval was not requested in this session.

## Gate Evidence

- Pre-coding documentation gate passed: required docs and Goal 07 execution/context/prompt/validation artifacts exist.
- `node --check scripts/smoke-check.js` passed.
- `bash -n scripts/deploy.sh` passed.
- `git diff --check` passed.
- `npm run build` passed after linking this worktree to the existing sibling remote dependency tree.
- `npm test -- --runInBand` passed with 3 suites and 8 tests.
- Mock HTTP smoke execution passed: health, readiness database/storage, info, protected endpoint rejection, dashboard summary, jobs, targets, recent runs.

## Backup Safety Evidence

- BAK-INV-001: No application-domain data ownership was added.
- BAK-INV-002: Smoke checks are read-only and do not call restore endpoints.
- BAK-INV-003: Smoke script uses environment-supplied tokens without printing values; readiness reports booleans and status, not secret values.
- BAK-INV-004: Readiness now surfaces database and storage evidence separately.
- BAK-INV-008: Unauthenticated `/jobs` rejection is part of smoke coverage.
- BAK-INV-009: Execution plan, context, prompt, validation report, and state updates were created.

## Passed Criteria

- Smoke test covers health, info, protected endpoint rejection, dashboard summary, jobs, targets, and recent runs.
- Health/readiness reports database and storage readiness separately.
- Deploy script runs a meaningful post-rollout backup service smoke check.
- Evidence log was updated for this implementation cycle.

## Failed Criteria

None for local/source validation. Production deployment evidence remains owner-gated and was not run.

## Deviations

Goal 07 was implemented in the remote Goal 06 worktree and branch because Goal 06 was already validated there and Goal 07 depends on that baseline. This preserves the original Goal 05 worktree and avoids mixing with its separate dirty state.

## Recommendation

Proceed to owner review. Deploy only after explicit owner approval, then record production smoke evidence from `scripts/deploy.sh`.
