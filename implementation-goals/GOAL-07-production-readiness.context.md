# CTX-BAK-G7: Production Readiness And Smoke Tests Context
```yaml
id: CTX-BAK-G7
status: active
source_goal: implementation-goals/GOAL-07-production-readiness.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```
## Purpose
This context package preserves the operational intent for Goal 07 before source changes: Backups deployments must produce evidence that the service is alive, dependencies are separately ready, Auth boundaries still reject unauthenticated management access, and read-only operational surfaces can be checked safely.
## Required Reading
- `AGENTS.md`
- `docs/orchestrator/INTENT.md`
- `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- `docs/process/PROJECT_INVARIANTS.md`
- `docs/process/OPERATIONAL_GATES.md`
- `docs/IMPLEMENTATION_STATE.md`
- `implementation-goals/GOAL-07-production-readiness.md`
- `scripts/deploy.sh`
- `src/health/health.controller.ts`
- `src/info/info.controller.ts`
- `src/dashboard/dashboard.controller.ts`
- `k8s/deployment.yaml`
`docs/orchestrator/backup-intent-plan.md` is referenced by the process docs but is missing in the remote repository at intake time. Goal 07 proceeds from the available original intent and project invariants; the missing file remains a documentation gap to restore later.
## Relevant Contracts
- `/health` is public liveness and must not depend on protected management authentication.
- `/health/readiness` is public dependency readiness and must report database and storage separately without exposing secret values.
- `/info` is public operational metadata.
- `/jobs`, `/targets`, `/backups`, and `/dashboard/summary` remain protected management/read endpoints.
- Smoke checks must not trigger backups, delete backup runs, alter retention, or initiate restore.
## Current Behavior
- `/health` returns static liveness without database/storage readiness detail.
- Kubernetes liveness and readiness probes both call `/health`.
- `scripts/deploy.sh` checks only pod-local `/health` after rollout.
- There is no reusable smoke script that checks public endpoints, protected rejection, dashboard summary, jobs, targets, and recent runs.
## Target Behavior
- `/health` remains a lightweight public liveness response.
- `/health/readiness` reports `database` and `storage` checks independently.
- Kubernetes readiness uses `/health/readiness` while liveness continues to use `/health`.
- Deploy runs a reusable smoke script after rollout.
- The smoke script verifies public liveness/info, protected unauthenticated rejection, and optionally authenticated read-only dashboard/jobs/targets/recent-runs checks when `BACKUPS_SMOKE_AUTH_HEADER` or `BACKUPS_SMOKE_TOKEN` is provided.
## Constraints
- No production deployment in this implementation session without owner approval.
- No secret values in docs, reports, source, or logs.
- No destructive or state-changing backup operations in smoke tests.
- Continue on the existing dirty branch because Goal 05 and Goal 06 remote changes are uncommitted.
## Validation Expectations
- Build and Jest pass.
- Shell syntax for the smoke script passes.
- Diff whitespace check passes.
- Runtime smoke check is run against the approved production URL only for non-destructive endpoints.
