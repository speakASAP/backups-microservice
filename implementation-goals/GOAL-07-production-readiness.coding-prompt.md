# CP-BAK-G7: Production Readiness And Smoke Tests Coding Prompt
```yaml
id: CP-BAK-G7
status: active
source_goal: implementation-goals/GOAL-07-production-readiness.md
source_plan: implementation-goals/GOAL-07-production-readiness.execution-plan.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```
## Assignment
Implement non-destructive production readiness checks for Backups so each deployment can verify public liveness, dependency readiness, unauthenticated rejection for protected routes, and authenticated read-only operational endpoints when an operator-provided smoke token is available.
## Scope
Allowed source and script files:
- `src/health/health.controller.ts`
- `scripts/deploy.sh`
- `scripts/smoke-test.sh`
- `k8s/deployment.yaml`
- `package.json`
Allowed documentation/state files:
- `implementation-goals/GOAL-07-production-readiness.*.md`
- `docs/IMPLEMENTATION_STATE.md`
- `STATE.json`
- `TASKS.md`
## Non-Goals
- Do not deploy to production without owner approval.
- Do not trigger backups, delete backup runs, or submit restore requests in smoke tests.
- Do not add secret values, JWTs, service tokens, object-store credentials, or raw artifact paths to source, docs, reports, or examples.
- Do not weaken Auth or make protected management endpoints public.
## Safety Requirements
- Smoke checks must be read-only except for ordinary HTTP GET requests.
- Protected endpoint checks must prove unauthenticated requests are rejected.
- Authenticated checks must require an operator-provided header or token through the runtime environment and must not print the token.
- Readiness output may report whether storage configuration is present, but must not expose credentials.
## Implementation Notes
- Keep `/health` as public liveness.
- Add a public readiness route that reports database and storage readiness as separate checks.
- Prefer deterministic HTTP checks in `scripts/smoke-test.sh` using Node's built-in `fetch` so no extra dependency is required.
- Let authenticated endpoint checks be optional by default and enforceable with `BACKUPS_SMOKE_REQUIRE_AUTH=true`.
- Wire `scripts/deploy.sh` to run the smoke script after rollout and liveness/readiness checks.
## Validation Required
- `npm run build`
- `npm test -- --runInBand`
- `bash -n scripts/smoke-test.sh`
- `git diff --check`
- Non-destructive HTTP smoke check against an approved target when available.
## Report Required
Return changed files, validation evidence, smoke target, skipped authenticated checks if no token was provided, risks, blockers, and intent compliance notes.
