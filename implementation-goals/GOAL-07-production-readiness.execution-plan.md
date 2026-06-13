# EP-BAK-G7: Production Readiness And Smoke Tests
```yaml
id: EP-BAK-G7
status: complete
source_goal: implementation-goals/GOAL-07-production-readiness.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
branch: codex/backups-goal-05-coverage-model
branch_deviation: Goal 07 expected codex/backups-goal-07-production-readiness, but remote Goal 05 and Goal 06 changes are uncommitted on the current branch. Continuing in place preserves existing worktree state.
```
## Metadata
Goal 07 is active for production readiness and smoke tests. No deploy, commit, or push is authorized in this session.
## Upstream Traceability
- Original intent: `docs/orchestrator/INTENT.md`
- Process: `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- Invariants: `docs/process/PROJECT_INVARIANTS.md`
- Gates: `docs/process/OPERATIONAL_GATES.md`
- State: `docs/IMPLEMENTATION_STATE.md`
- Selected goal: `implementation-goals/GOAL-07-production-readiness.md`
- Missing referenced upstream: `docs/orchestrator/backup-intent-plan.md` is absent in the remote repo at intake.
## Goal Impact
This goal improves operator evidence after each deployment by checking service liveness, dependency readiness, Auth rejection for protected routes, and read-only operational surfaces for dashboard summary, jobs, targets, and recent runs.
## Backup Safety Invariants
- BAK-INV-001 ownership: smoke checks stay within Backups operations and evidence.
- BAK-INV-003 secrets: no secret values in readiness, smoke output, docs, or source.
- BAK-INV-004 recoverability: smoke checks include recent run visibility and dashboard summary.
- BAK-INV-008 auth: protected management endpoints must reject unauthenticated requests.
- BAK-INV-009 operations: preserve plan, context, prompt, validation, and state evidence.
## Sensitive-Data Handling
Readiness reports only boolean/configured status and sanitized error messages. Smoke auth is accepted only through environment-provided token/header and is never printed. Smoke tests do not emit backup artifact paths, credentials, JWTs, service tokens, or raw production data.
## Contract/Schema Impact
No database schema change. API addition: `GET /health/readiness` returns dependency checks for database and storage. `/health` keeps public liveness behavior.
## Scope
- Add dependency readiness details.
- Add reusable smoke test script.
- Wire deploy post-rollout smoke check.
- Update Kubernetes readiness probe path.
- Update Goal 07 validation and project state.
## Non-Goals
- No production deployment without owner approval.
- No backup trigger, backup deletion, restore request, or retention mutation in smoke tests.
- No Auth weakening or public management endpoints.
## Files To Inspect
- `scripts/deploy.sh`
- `src/health/health.controller.ts`
- `src/info/info.controller.ts`
- `src/dashboard/dashboard.controller.ts`
- `k8s/deployment.yaml`
- `docs/IMPLEMENTATION_STATE.md`
## Files To Create
- `scripts/smoke-test.sh`
- `implementation-goals/GOAL-07-production-readiness.context.md`
- `implementation-goals/GOAL-07-production-readiness.coding-prompt.md`
- `implementation-goals/GOAL-07-production-readiness.validation.md`
## Files To Modify
- `src/health/health.controller.ts`
- `scripts/deploy.sh`
- `k8s/deployment.yaml`
- `package.json`
- `docs/IMPLEMENTATION_STATE.md`
- `STATE.json`
- `TASKS.md`
## Files That Must Not Be Modified
- `BUSINESS.md`
- `GOALS.md`
- Secret manifests or secret values
- Backup, restore, retention, and audit state-transition code outside smoke/readiness needs
## Implementation Steps
1. Add a public readiness endpoint with separate database and storage checks.
2. Update Kubernetes readiness probe to use the readiness endpoint.
3. Add a Node-backed smoke shell script with unauthenticated and optional authenticated read-only checks.
4. Add an npm smoke alias and call the script from deploy after rollout health checks.
5. Validate build, tests, shell syntax, diff hygiene, safety scans, and non-destructive runtime smoke where available.
6. Update validation and state artifacts.
## Test Plan
Run `npm run build`, `npm test -- --runInBand`, `bash -n scripts/smoke-test.sh`, and `git diff --check`.
## Validation Plan
Run the smoke script against `https://backups.alfares.cz` without credentials to verify public health/info and protected endpoint rejection. Authenticated protected read checks require owner-provided `BACKUPS_SMOKE_AUTH_HEADER` or `BACKUPS_SMOKE_TOKEN`.
## Gate Commands
```bash
npm run build
npm test -- --runInBand
bash -n scripts/smoke-test.sh
git diff --check
```
## Documentation Updates
Update Goal 07 validation plus implementation state, task state, and machine state.
## Rollback Plan
Revert the readiness endpoint, Kubernetes readiness path, smoke script, deploy hook, package alias, and Goal 07 state updates. No persistent data or schema migration is changed.
## Agent Handoff Prompt
Implement Goal 07 production readiness in the remote repo only. Keep smoke tests read-only, preserve protected endpoint rejection, do not expose secrets, and do not deploy without owner approval.
## Completion Checklist
- [x] Implementation complete
- [x] Tests complete
- [x] Validation evidence collected
- [x] Documentation updated
- [x] Deviations documented
