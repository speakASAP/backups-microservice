# CP-BAK-G6: Safety And Audit Controls Coding Prompt

```yaml
id: CP-BAK-G6
status: active
source_goal: implementation-goals/GOAL-06-safety-audit-controls.md
source_plan: implementation-goals/GOAL-06-safety-audit-controls.execution-plan.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
```

## Assignment

Implement Goal 06 safety and audit controls for retention policies, backup-run deletion, production restore approval, and audit evidence in the remote Goal 06 worktree only.

## Scope

- Add structured audit logging for safety-sensitive operations.
- Add retention approval metadata to backup jobs and enforce retention minimum rules in the service layer.
- Gate backup-run deletion behind explicit owner approval metadata and audit reason, or fail closed when metadata is absent.
- Add restore approval fields to DTO/entity/service and require them for production restore requests.
- Update admin UI forms/tables to collect and show approval evidence.
- Add an additive migration and update Goal 06 validation/state artifacts.

## Non-Goals

- No production restore execution outside existing request flow.
- No deletion of existing backup runs during implementation.
- No deployment, commit, or push.
- No edits to `BUSINESS.md`, `GOALS.md`, secrets, or production environment files.
- No new source-category executor implementation.

## Safety Requirements

- Retention below three full backups requires approval actor and reason.
- Production restore requires approval actor, reason, target environment, and explicit confirmation metadata.
- Backup-run deletion without approval metadata must fail closed.
- Audit records must be structured and secret-safe.
- Public backup run serialization must continue omitting `storage_path` and `walg_output`.
- UI, logs, tests, docs, and prompts must not include secret values or raw backup artifact paths.
- Existing management auth behavior must not be weakened.

## Implementation Notes

Follow local NestJS/TypeORM patterns: entity + module + service, additive migration, DTO validation with `class-validator`, and controller extraction of `req.user.sub` or email where available. Prefer service-layer guardrails so UI checks cannot be bypassed by API clients.

## Validation Required

```bash
npm run build
npm test -- --runInBand
node --check web/admin/app.js
```

Also perform manual safety review for retention, deletion, restore approval, audit fields, auth boundaries, and secret exposure.

## Report Required

Return:

- files changed;
- tests/checks run;
- validation evidence;
- risks;
- blockers;
- intent compliance notes.
