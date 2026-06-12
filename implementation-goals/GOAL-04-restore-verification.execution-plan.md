# EP-BAK-G4: Restore Verification Evidence

```yaml
id: EP-BAK-G4
status: draft
source_goal: implementation-goals/GOAL-04-restore-verification.md
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - docs/orchestrator/INTENT.md
  - docs/orchestrator/backup-intent-plan.md
  - docs/process/INTENT_PRESERVATION_SYSTEM.md
  - docs/process/PROJECT_INVARIANTS.md
downstream:
  - implementation-goals/GOAL-04-restore-verification.context.md
  - implementation-goals/GOAL-04-restore-verification.coding-prompt.md
  - implementation-goals/GOAL-04-restore-verification.validation.md
related_adrs: []
```

## Metadata

- Goal: `BAK-G4`
- Branch: `codex/backups-goal-04-restore-verification`
- Lifecycle state: ready for pre-coding gate
- Owner approval required before deployment: yes
- Commit/push policy: do not commit or push unless owner explicitly asks

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Expanded roadmap: `docs/orchestrator/backup-intent-plan.md`
- Goal definition: `implementation-goals/GOAL-04-restore-verification.md`
- Current state: `docs/IMPLEMENTATION_STATE.md`
- Required process: `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- Project invariants: `docs/process/PROJECT_INVARIANTS.md`

## Goal Impact

This goal prevents false operational confidence. Backups must show whether each backup run has restore evidence, is pending verification, failed verification, or was intentionally skipped with a reason.

## Project Invariants

Applicable invariants:

- `BAK-INV-001`: Backups owns restore evidence, not application-domain data.
- `BAK-INV-002`: Production restore remains human-approved and cannot be triggered accidentally.
- `BAK-INV-003`: Verification evidence must not expose secrets or sensitive artifact paths.
- `BAK-INV-004`: A backup cannot be presented as fully operationally successful without verification state.
- `BAK-INV-006`: Verification state changes must leave evidence.
- `BAK-INV-008`: Management endpoints remain protected.
- `BAK-INV-009`: Execution plan, context package, coding prompt, validation, and state updates are required.

## Sensitive-Data Handling

Data classification: operational metadata only.

Allowed:

- backup run IDs;
- target IDs and names;
- job IDs and names;
- verification status;
- timestamps;
- non-sensitive failure summaries.

Forbidden:

- secret values;
- passwords, access keys, JWTs, private keys, TLS keys;
- raw production data;
- sensitive backup artifact paths;
- MinIO credentials or signed URLs.

Prompts, tests, screenshots, reports, UI, and logs must use synthetic examples or metadata-only evidence.

## Contract Validation Plan

Expected contract impact:

- Backup run entity/status may gain explicit verification fields or status values.
- Dashboard summary may expose verification metadata.
- Admin UI may display verification state.
- Notifications may add verification success/failure messages.

Validation:

- TypeScript build.
- Existing and focused Jest tests where practical.
- `node --check web/admin/app.js` if frontend JS changes.
- Manual inspection that API/UI output does not expose secrets.

## Replay/Determinism Plan

Verification state transitions must be idempotent enough that repeated backup completion handling does not create contradictory evidence. If a real verification environment is unavailable, the implementation must record `pending` or `skipped` with a reason rather than implying verified success.

## Scope

Implement restore verification evidence for backup runs and operator visibility.

In scope:

- verification lifecycle representation;
- backup success flow recording verification pending/skipped/success/failure evidence;
- dashboard summary exposure of verification state;
- UI display of verification state;
- notification distinction between backup and verification outcomes;
- tests or documented validation evidence.

## Non-Goals

- Do not run production restore.
- Do not implement full service coverage inventory.
- Do not harden retention, deletion, or production restore approval beyond verification-specific needs.
- Do not change Vault/Auth ownership boundaries.
- Do not expose secrets or sensitive backup artifact paths.
- Do not deploy without owner approval.

## Files To Inspect

```text
src/backup/entities/backup-run.entity.ts
src/backup/backup.service.ts
src/backup/backup.controller.ts
src/restore/restore.service.ts
src/notifications/notifications.service.ts
src/dashboard/dashboard.service.ts
web/admin/app.js
web/admin/index.html
web/admin/jobs.html
web/admin/restore.html
docs/orchestrator/INTENT.md
docs/orchestrator/backup-intent-plan.md
docs/process/PROJECT_INVARIANTS.md
```

## Files To Create

```text
implementation-goals/GOAL-04-restore-verification.validation.md
```

Tests may be added if the current test layout supports focused coverage.

## Files To Modify

Expected candidates:

```text
src/backup/entities/backup-run.entity.ts
src/backup/backup.service.ts
src/notifications/notifications.service.ts
src/dashboard/dashboard.service.ts
web/admin/app.js
docs/IMPLEMENTATION_STATE.md
STATE.json
TASKS.md
implementation-goals/GOAL-04-restore-verification.md
```

Only modify additional files if the implementation requires it and document the deviation in the validation report.

## Files That Must Not Be Modified

```text
BUSINESS.md
GOALS.md
docs/orchestrator/INTENT.md
docs/orchestrator/backup-intent-plan.md
k8s/external-secret.yaml
```

Do not modify production deployment manifests unless the owner explicitly requests deployment-related work.

## Implementation Steps

1. Inspect current backup run entity/status and backup completion flow.
2. Inspect dashboard summary and admin UI rendering for recent runs.
3. Choose the smallest verification evidence model that preserves existing data compatibility.
4. Add verification pending/skipped/success/failure evidence without implying verified restore when no verification ran.
5. Expose verification metadata in the read-only dashboard summary.
6. Render verification state in the operator UI.
7. Add notification distinction for backup completion vs verification outcome if the notification service supports it.
8. Add or update focused tests where feasible.
9. Run validation commands and manual safety checks.
10. Update state files and validation report.

## Test Plan

- Run `npm run build`.
- Run `npm test -- --runInBand` or focused Jest tests if the full suite is not practical.
- Run `node --check web/admin/app.js`.
- Manually inspect changed files for secret exposure and unsafe restore behavior.

## Validation Plan

Validation must confirm:

- backup run verification state is represented;
- unverified backups are not shown as verified;
- dashboard/UI expose only safe metadata;
- notifications distinguish verification result when implemented;
- build/tests pass or blocker is recorded;
- no protected files were modified.

## Gate Commands

```bash
git status --short --branch
npm run build
npm test -- --runInBand
node --check web/admin/app.js
```

Manual gates:

- documentation gate from `docs/process/OPERATIONAL_GATES.md`;
- invariant check from `docs/process/PROJECT_INVARIANTS.md`;
- secret exposure scan of changed files;
- restore safety review.

## Documentation Updates

Update:

- `implementation-goals/GOAL-04-restore-verification.validation.md`;
- `implementation-goals/GOAL-04-restore-verification.md`;
- `docs/IMPLEMENTATION_STATE.md`;
- `STATE.json`;
- `TASKS.md`.

## Rollback Plan

Before commit, rollback is by reverting this goal's changed files only. Do not revert unrelated user changes. If a schema migration is introduced later, rollback must include an explicit data-compatibility note in the validation report.

## Agent Handoff Prompt

Implement `BAK-G4` using this execution plan. Preserve the original Backups intent: no secrets in source/UI/logs/prompts/reports, no production restore, no accidental restore trigger, and no false verified-success state. Modify only the allowed files unless a documented deviation is necessary. Run the validation commands or record exact blockers. Finish with an Intent Compliance Report and update state files.

## Completion Checklist

- [ ] Implementation complete
- [ ] Tests complete
- [ ] Validation evidence collected
- [ ] Documentation updated
- [ ] Deviations documented
- [ ] Intent Compliance Report produced
