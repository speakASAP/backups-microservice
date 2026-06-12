# CP-BAK-G4: Restore Verification Evidence Coding Prompt

```yaml
id: CP-BAK-G4
status: draft
source_goal: implementation-goals/GOAL-04-restore-verification.md
source_plan: implementation-goals/GOAL-04-restore-verification.execution-plan.md
source_context: implementation-goals/GOAL-04-restore-verification.context.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - docs/orchestrator/INTENT.md
  - docs/process/PROJECT_INVARIANTS.md
downstream:
  - implementation-goals/GOAL-04-restore-verification.validation.md
related_adrs: []
```

## Assignment

Implement `BAK-G4 Restore Verification Evidence` so backup runs expose a truthful verification lifecycle and operators can see whether restore verification succeeded, failed, is pending, or was intentionally skipped with a reason.

## Scope

Allowed scope:

- backup run verification state/evidence model;
- backup success flow verification evidence;
- dashboard summary verification metadata;
- admin UI verification display;
- notification distinction for verification results;
- focused tests where practical;
- state and validation docs for this goal.

## Non-Goals

- Do not perform production restore.
- Do not implement Goal 05 coverage inventory.
- Do not implement Goal 06 retention/deletion/approval hardening except where verification-specific evidence requires it.
- Do not change Auth, Vault, PostgreSQL runtime, or MinIO runtime ownership boundaries.
- Do not deploy, commit, or push unless the owner explicitly asks.

## Safety Requirements

- Never expose secret values, credentials, tokens, private keys, passwords, raw production data, or sensitive backup artifact paths.
- Never imply that a backup is verified if verification did not run.
- If live verification cannot run safely, record `pending` or `skipped` with a reason.
- Keep production restore human-approved and hard to trigger accidentally.
- Preserve existing PostgreSQL backup behavior unless a documented migration is required.

## Implementation Notes

Read the execution plan and context package first:

```text
implementation-goals/GOAL-04-restore-verification.execution-plan.md
implementation-goals/GOAL-04-restore-verification.context.md
```

Prefer the smallest model that supports truthful operator evidence and backward compatibility.

Record deviations if additional files must be modified.

## Validation Required

Run or record blockers for:

```bash
npm run build
npm test -- --runInBand
node --check web/admin/app.js
```

Manual checks:

- no secret values in changed docs/source/tests/UI;
- no accidental production restore path;
- dashboard/UI distinguish unverified from verified backup runs;
- protected endpoints remain protected.

## Report Required

Return:

- files changed;
- implementation summary;
- tests/checks run;
- validation evidence;
- invariant evidence;
- risks and blockers;
- deviations from plan;
- next action.
