# CP-BAK-G5: Coverage Model Coding Prompt

```yaml
id: CP-BAK-G5
status: active
source_goal: implementation-goals/GOAL-05-coverage-model.md
source_plan: implementation-goals/GOAL-05-coverage-model.execution-plan.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Assignment

Implement Goal 05 coverage metadata for backup targets and dashboard coverage visibility.

## Scope

Allowed files: target entity/DTOs, dashboard service, one additive migration, admin dashboard JS/HTML, Goal 05 docs, intent plan, validation/state files.

## Non-Goals

Do not implement non-PostgreSQL backup execution. Do not deploy, commit, push, edit human-owned documents, expose secrets, or change production restore/deletion/retention policy beyond visible metadata.

## Safety Requirements

- Secret values remain forbidden in API responses, UI, docs, reports, tests, and logs.
- PostgreSQL targets remain backward-compatible.
- Non-Postgres target classes are documented contracts only.
- Management API protection remains unchanged.
- Coverage gaps must not imply that unimplemented source classes are protected.

## Implementation Notes

Use nullable/defaulted columns for new target metadata. Keep enum values as strings. Dashboard should include source category stats and unprotected discovered services using live discovery data only as operator visibility, not as the canonical service inventory.

## Validation Required

- `npm run build`
- `npm test -- --runInBand`
- `node --check web/admin/app.js`
- Manual invariant and secret-safety review

## Report Required

Return:

- files changed;
- tests/checks run;
- validation evidence;
- risks;
- blockers;
- intent compliance notes.
