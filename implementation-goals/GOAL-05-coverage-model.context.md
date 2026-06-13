# CTX-BAK-G5: Ecosystem Coverage Model Context

```yaml
id: CTX-BAK-G5
status: approved
source_goal: implementation-goals/GOAL-05-coverage-model.md
source_plan: implementation-goals/GOAL-05-coverage-model.execution-plan.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```

Upstream: docs/orchestrator/INTENT.md, docs/orchestrator/backup-intent-plan.md, docs/process/INTENT_PRESERVATION_SYSTEM.md, docs/process/PROJECT_INVARIANTS.md.
Safety: metadata only; no secret values, raw production data, signed URLs, or sensitive backup artifact paths. Contract-only sources must not get executable WAL-G jobs.
Validation: npm run build; npm test -- --runInBand; node --check web/admin/app.js.

## Current Behavior

The branch already has partial coverage fields in `BackupTarget`, DTOs, dashboard coverage stats, and UI labels. Missing pieces are the migration, executable-job guard, source contract visibility, focused tests, and validation/state artifacts.

## Target Behavior

Existing targets default to PostgreSQL coverage. Unsupported categories are visible as coverage contracts only and cannot be scheduled through WAL-G.
