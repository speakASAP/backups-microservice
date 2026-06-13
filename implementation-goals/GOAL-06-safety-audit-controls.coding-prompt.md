# CP-BAK-G6: Safety And Audit Controls Coding Prompt

```yaml
id: CP-BAK-G6
status: active
source_goal: implementation-goals/GOAL-06-safety-audit-controls.md
source_plan: implementation-goals/GOAL-06-safety-audit-controls.execution-plan.md
owner: orchestrator
created: 2026-06-13
last_updated: 2026-06-13
```

## Assignment

Implement BAK-G6 safety and audit controls in the remote `backups-microservice` repository. Harden retention, deletion, restore approval, and audit evidence while preserving restore verification, coverage model, Auth, and secret-handling behavior.

## Scope

- Add audit event persistence and migration.
- Add retention approval metadata to backup jobs and enforce it in create/update flows.
- Disable backup-run deletion by default and audit denied attempts.
- Require explicit restore approval fields and actor evidence before creating restore requests.
- Update admin schedules/restore UI so low retention and restore are visually distinct and require reason/confirmation evidence.
- Add focused tests for new safety contracts.
- Update validation and state artifacts.

## Non-Goals

- No real backup-run deletion.
- No production restore.
- No deployment, commit, or push.
- No secret values in docs, prompts, tests, logs, UI, or API responses.
- No changes to `BUSINESS.md` or `GOALS.md`.
- No weakening of the global Auth guard.

## Safety Requirements

- Retention below three full backups must fail unless explicit owner approval metadata is present.
- Restore submission must include actor, reason, exact target confirmation, exact backup run confirmation, and production confirmation.
- Audit events must include actor, action, reason, and any applicable target/job/run/request IDs.
- Public backup responses must keep hiding `storage_path` and `walg_output`.
- Restore history must not return raw WAL-G output or secrets.

## Implementation Notes

- Use existing NestJS/TypeORM patterns.
- Keep DTO validation with `class-validator` decorators.
- The global `JwtRolesGuard` already protects management endpoints; controller changes may read `req.user` for actor evidence.
- Goal 05 uncommitted changes are present; do not revert them.
- Use synthetic data in tests.

## Validation Required

```bash
npm run build
npm test -- --runInBand
node --check web/admin/app.js
curl -sk -o /dev/null -w "%{http_code}
" https://backups.alfares.cz/jobs
```

Also review changed files for secret exposure and confirm no code path deletes backup-run rows.

## Report Required

Return:

- files changed;
- tests/checks run;
- validation evidence;
- risks;
- blockers;
- intent compliance notes.
