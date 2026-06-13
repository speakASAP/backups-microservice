# VAL-BAK-G6: Safety And Audit Controls Validation Report

```yaml
id: VAL-BAK-G6
status: passed
validated_artifact: implementation-goals/GOAL-06-safety-audit-controls.md
owner: validator
created: 2026-06-13
last_updated: 2026-06-13
```

## Artifact Validated

- Goal: BAK-G6 Safety And Audit Controls.
- Branch: `codex/backups-goal-05-coverage-model` with recorded deviation because Goal 05 dependency changes are uncommitted there.
- Commit: not committed; owner has not requested commit or push.

## Validation Scope

Validated retention approval guardrails, backup-run deletion disablement, production restore approval evidence, audit event persistence, Auth protection, admin UI destructive-operation friction, and secret-handling boundaries.

## Evidence

- Added `audit_events` persistence for safety-relevant actions.
- Added retention approval metadata to backup jobs and backend validation for retention below three full backups.
- Changed backup-run deletion to audit and deny rather than remove rows.
- Added restore approval actor, reason, exact target/run confirmations, and production approval fields.
- Sanitized restore API responses so related backup runs are serialized through `BackupService.toPublicRun` and restore `walg_output` is omitted.
- Updated admin UI to require approval metadata for low retention and exact ID confirmations for restore.

## Gate Evidence

- `npm run build`: passed.
- `npm test -- --runInBand`: passed, 4 suites and 12 tests.
- `node --check web/admin/app.js`: passed.
- `git diff --check`: passed.
- `curl -sk -o /dev/null -w "%{http_code}\n" https://backups.alfares.cz/jobs`: returned `401`, confirming unauthenticated management endpoint rejection.

## Backup Safety Evidence

- BAK-INV-002 production restore approval: `CreateRestoreDto` and `RestoreService.create` require authenticated actor evidence, approval actor, approval reason, exact target/run confirmations, and production approval boolean.
- BAK-INV-003 secret handling: no secret values added; public backup and restore serializers omit `storage_path` and `walg_output`.
- BAK-INV-005 low-retention approval: `JobsService` rejects retention below three full backups without approval actor and reason, and stores approval metadata when accepted.
- BAK-INV-006 audit trail: audit events record actor, action, reason, and applicable target/job/run/restore request IDs for retention approval, deletion denial, and restore lifecycle events.
- BAK-INV-008 Auth protection: deployed unauthenticated `/jobs` check returned `401`; global guard remains in place.
- BAK-INV-009 IPS chain: execution plan, context package, coding prompt, validation report, and state files were updated.

## Passed Criteria

- Retention below three full backups requires explicit owner approval metadata.
- Backup run deletion is disabled at the service layer and denied attempts are audited.
- Production restore requires explicit approval fields and actor evidence.
- Audit events include actor, target, job, run, action, and reason where applicable.
- UI makes low-retention and restore operations visibly distinct and harder to trigger accidentally.

## Failed Criteria

None.

## Deviations

- Goal 06 work was completed on `codex/backups-goal-05-coverage-model` because Goal 05 dependency changes were uncommitted on that branch and had to be preserved.
- Direct `scp` to `ssf@192.168.88.53` was used for multi-file remote writes because local `scp alfares` resolved through a broken `alfares.local` path; all files were still changed only in the remote source-of-truth repository.

## Recommendation

Proceed to BAK-G7 production readiness and smoke tests after owner review. Do not deploy, commit, or push until explicitly requested.
