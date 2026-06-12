# EP-BAK-G7: Production Readiness And Smoke Tests

```yaml
id: EP-BAK-G7
status: active
source_goal: implementation-goals/GOAL-07-production-readiness.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
branch: codex/backups-goal-06-safety-audit-controls
worktree: /home/ssf/Documents/Github/backups-microservice-goal06
```

## Metadata

Goal BAK-G7 is being implemented in the remote Goal 06 worktree because Goal 06 is already validated there and Goal 07 depends on that safety-control baseline. The original Goal 05 worktree remains untouched.

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Intent plan: `docs/orchestrator/backup-intent-plan.md`
- Process: `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- Invariants: `docs/process/PROJECT_INVARIANTS.md`
- Gate standard: `docs/process/OPERATIONAL_GATES.md`
- Selected goal: `implementation-goals/GOAL-07-production-readiness.md`
- State: `docs/IMPLEMENTATION_STATE.md`

## Goal Impact

This goal makes post-deploy backup operations verifiable by separating liveness from readiness, reporting database and storage readiness independently, and running non-destructive smoke checks after Kubernetes rollout.

## Backup Safety Invariants

- BAK-INV-001: Backups remains the disaster-recovery control plane and does not own application domain data.
- BAK-INV-002: Production restore remains human-approved; smoke checks must not trigger restore.
- BAK-INV-003: Secret values must not appear in scripts, reports, logs, or API responses.
- BAK-INV-004: Backup evidence must surface verification/readiness status.
- BAK-INV-008: Management endpoints remain protected; smoke verifies unauthenticated rejection.
- BAK-INV-009: IPS artifacts, validation, and state updates are required.

## Sensitive-Data Handling

Smoke tests may use an in-pod service token through environment variables but must never print token values. Health/readiness responses expose configured booleans and status only, not passwords, tokens, access keys, or raw storage artifact paths.

## Contract/Schema Impact

No database schema change. API contract changes are additive: `GET /health` includes readiness check summaries and `GET /health/readiness` returns database and storage readiness. Kubernetes readiness probe moves to `/health/readiness`.

## Scope

- Add database and storage readiness reporting to the health controller.
- Add non-destructive smoke testing for health, readiness, info, protected endpoint rejection, dashboard summary, jobs, targets, and recent runs.
- Wire deploy script to run smoke checks after rollout.
- Update Kubernetes readiness probe path.
- Add focused tests and validation evidence.

## Non-Goals

- No production deployment without owner approval.
- No destructive backup deletion, retention weakening, or production restore.
- No secret values in output or fixtures.
- No changes to Auth, Vault, MinIO, or application-domain ownership.

## Files To Inspect

- `scripts/deploy.sh`
- `src/health/health.controller.ts`
- `src/info/info.controller.ts`
- `src/dashboard/dashboard.controller.ts`
- `k8s/deployment.yaml`
- `docs/IMPLEMENTATION_STATE.md`

## Files To Create

- `scripts/smoke-check.js`
- `test/health.controller.spec.ts`
- `implementation-goals/GOAL-07-production-readiness.execution-plan.md`
- `implementation-goals/GOAL-07-production-readiness.context.md`
- `implementation-goals/GOAL-07-production-readiness.coding-prompt.md`
- `implementation-goals/GOAL-07-production-readiness.validation.md`

## Files To Modify

- `scripts/deploy.sh`
- `src/health/health.controller.ts`
- `k8s/deployment.yaml`
- `Dockerfile`
- `docs/IMPLEMENTATION_STATE.md`
- `STATE.json`
- `TASKS.md`
- `implementation-goals/GOAL-07-production-readiness.md`

## Files That Must Not Be Modified

- `BUSINESS.md`
- `GOALS.md`
- secret manifests containing literal secret values
- unrelated source modules outside readiness/smoke-test scope

## Implementation Steps

1. Create Goal 07 IPS artifacts and validation shell.
2. Add health/readiness logic with separate database and storage checks.
3. Add a reusable smoke runner that supports optional bearer auth without printing token values.
4. Update deploy script to run the smoke runner inside the rolled-out pod.
5. Update Kubernetes readiness probe to use `/health/readiness`.
6. Add focused unit tests and run gates.
7. Update goal/state/task evidence.

## Test Plan

- Unit-test health/readiness responses for database/storage ready and degraded states.
- Run `npm run build`.
- Run `npm test -- --runInBand`.
- Run `node --check scripts/smoke-check.js`.
- Run `git diff --check`.
- Run non-destructive smoke checks only against approved/local target or document why skipped.

## Validation Plan

Validate acceptance criteria through tests, source review, and non-destructive HTTP smoke behavior. Record that production deployment and production evidence require explicit owner approval.

## Gate Commands

```bash
npm run build
npm test -- --runInBand
node --check scripts/smoke-check.js
git diff --check
```

## Documentation Updates

- Update Goal 07 status and validation report.
- Update implementation state evidence log.
- Update `STATE.json` and `TASKS.md` next action.

## Rollback Plan

Revert the readiness controller changes, smoke script, deploy hook, Kubernetes readiness path, tests, and Goal 07 state updates. No data migration is involved.

## Agent Handoff Prompt

Implement BAK-G7 in `/home/ssf/Documents/Github/backups-microservice-goal06`. Keep changes within the listed file scope, preserve Goal 06 safety controls, do not deploy, do not expose secrets, and run the listed validation gates before reporting completion.

## Completion Checklist

- [ ] Implementation complete
- [ ] Tests complete
- [ ] Validation evidence collected
- [ ] Documentation updated
- [ ] Deviations documented
