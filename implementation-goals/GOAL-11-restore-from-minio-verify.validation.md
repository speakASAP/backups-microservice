# VAL-BAK-G11: Restore From MinIO And Verify Validation

```yaml
id: VAL-BAK-G11
status: passed-and-deployed
validated_artifact: implementation-goals/GOAL-11-restore-from-minio-verify.md
owner: validator
created: 2026-06-13
last_updated: 2026-06-13
```

## Evidence

- Added `restore-execution` helpers for isolated restore working directories, WAL-G backup name extraction, and successful-run guardrails.
- `RestoreService` now rejects non-success backup runs before execution.
- `RestoreService` writes backup-run verification evidence as `verifying`, `verified`, or `failed` around restore execution.
- Restore module injects `BackupRun` repository directly for verification evidence persistence.
- Public restore serialization still omits raw `walg_output` and sanitizes nested backup run through `BackupService.toPublicRun`.

## Gate Evidence

- `npm run build`: passed.
- `npm test -- --runInBand`: passed with 8 suites and 27 tests.
- `bash -n scripts/smoke-test.sh`: passed.
- `git diff --check`: passed.

## Deployment Evidence

- Production deployment completed on 2026-06-13 as part of the approved combined schema/nightly/schedule/restore rollout. Image `localhost:5000/backups-microservice:fc8c225f` rolled out in namespace `statex-apps`; health, readiness, and full smoke passed. No restore was executed during deployment validation.

## Backup Safety Evidence

No restore was executed during validation. Production restore approval fields remain required. Backup-run deletion remains disabled. Raw WAL-G output remains excluded from public restore responses.

## Recommendation

Deployed successfully as part of the approved combined deployment. Production restore execution should still require an explicit operator-created restore request with exact target/run confirmation.
