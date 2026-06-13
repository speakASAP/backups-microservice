# CP-BAK-G5: Ecosystem Coverage Model Coding Prompt

```yaml
id: CP-BAK-G5
status: approved
source_goal: implementation-goals/GOAL-05-coverage-model.md
source_plan: implementation-goals/GOAL-05-coverage-model.execution-plan.md
source_context: implementation-goals/GOAL-05-coverage-model.context.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```

## Assignment

Complete Goal 05 by making coverage metadata durable, visible, and safe.

## Requirements

Upstream: docs/orchestrator/INTENT.md, docs/orchestrator/backup-intent-plan.md, docs/process/INTENT_PRESERVATION_SYSTEM.md, docs/process/PROJECT_INVARIANTS.md.
Safety: metadata only; no secret values, raw production data, signed URLs, or sensitive backup artifact paths. Contract-only sources must not get executable WAL-G jobs.
Validation: npm run build; npm test -- --runInBand; node --check web/admin/app.js.

## Non-Goals

No executable backup support for MinIO, Kubernetes resources, secrets, or PVCs. No deployment, commit, push, restore, protected-doc edits, or secret exposure.
