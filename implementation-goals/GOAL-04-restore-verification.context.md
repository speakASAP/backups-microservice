# CTX-BAK-G4: Restore Verification Evidence Context

```yaml
id: CTX-BAK-G4
status: draft
source_goal: implementation-goals/GOAL-04-restore-verification.md
source_plan: implementation-goals/GOAL-04-restore-verification.execution-plan.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - docs/orchestrator/INTENT.md
  - docs/orchestrator/backup-intent-plan.md
  - docs/process/PROJECT_INVARIANTS.md
downstream:
  - implementation-goals/GOAL-04-restore-verification.coding-prompt.md
  - implementation-goals/GOAL-04-restore-verification.validation.md
related_adrs: []
```

## Purpose

This context package gives a coding agent the bounded information needed to implement restore verification evidence without reading unrelated project history or weakening backup safety.

## Required Reading

Read these before coding:

```text
AGENTS.md
TASKS.md
STATE.json
docs/IMPLEMENTATION_STATE.md
docs/orchestrator/INTENT.md
docs/orchestrator/backup-intent-plan.md
docs/process/INTENT_PRESERVATION_SYSTEM.md
docs/process/PROJECT_INVARIANTS.md
implementation-goals/GOAL-04-restore-verification.md
implementation-goals/GOAL-04-restore-verification.execution-plan.md
```

Inspect these code files:

```text
src/backup/entities/backup-run.entity.ts
src/backup/backup.service.ts
src/restore/restore.service.ts
src/notifications/notifications.service.ts
src/dashboard/dashboard.service.ts
web/admin/app.js
```

## Relevant Contracts

Backups contract:

- owns backup targets, jobs, backup run evidence, restore requests, restore verification, retention guardrails, and operator status;
- does not own application-domain data, PostgreSQL runtime, MinIO runtime, Vault secrets, or Auth identity policy.

Restore contract:

- production restore is destructive and owner-approved;
- verification evidence must not become an accidental production restore trigger;
- unverified backup runs must be visible as pending, skipped, failed, or unknown, not silently treated as verified.

Secret contract:

- API, UI, docs, prompts, reports, tests, and logs must never expose secret values or sensitive backup artifact paths;
- show secret references or safe operational metadata only.

UI contract:

- operators need clear backup run status and verification evidence;
- UI must handle unauthenticated API responses clearly;
- destructive actions must remain visually distinct and hard to trigger accidentally.

## Current Behavior

The project docs state that backups that cannot be restored are failures. The current plan records that `BackupRunStatus.VERIFYING` exists but is not fully used, and backup success does not yet store a separate restore verification outcome.

The next orchestrated action in `docs/IMPLEMENTATION_STATE.md` is `BAK-G4 Restore verification evidence`.

## Target Behavior

After Goal 04:

- each backup run can show verification lifecycle and result;
- successful backup flow either starts/runs verification or records that verification is pending or skipped with a reason;
- dashboard summary and UI expose verification state using safe metadata;
- notifications distinguish backup completion from verification outcome;
- validation report records evidence and remaining gaps.

## Constraints

- Do not perform production restore.
- Do not expose credentials, tokens, private keys, passwords, raw production data, or sensitive artifact paths.
- Do not implement coverage inventory; that is Goal 05.
- Do not implement retention/deletion/restore approval hardening beyond verification-specific support; that is Goal 06.
- Do not deploy, commit, or push without owner approval.

## Validation Expectations

Run or record blockers for:

```bash
npm run build
npm test -- --runInBand
node --check web/admin/app.js
```

Manual validation:

- changed files contain no secret values;
- production restore remains blocked behind explicit owner approval;
- UI/API do not show sensitive artifact paths;
- unverified backups are not represented as verified.
