# VAL-BAK-G7: Production Readiness And Smoke Tests Validation

```yaml
id: VAL-BAK-G7
status: passed-and-deployed
validated_artifact: implementation-goals/GOAL-07-production-readiness.md
owner: validator
created: 2026-06-13
last_updated: 2026-06-13
```

## Artifact Validated

Goal 07 production readiness and smoke tests on branch `codex/backups-goal-05-coverage-model` with a recorded branch deviation because prior Goal 05 and Goal 06 changes are uncommitted on the remote source-of-truth worktree.

## Validation Scope

- Public liveness and readiness contract.
- Separate database and storage readiness reporting.
- Non-destructive smoke script coverage for health, readiness, info, protected rejection, dashboard summary, jobs, targets, and recent runs.
- Deploy post-rollout smoke hook.
- Safety and secret-handling invariants.

## Evidence

- `GET /health` remains public liveness.
- `GET /health/readiness` reports `database` and `storage` checks separately and returns non-ready HTTP status when either check is degraded.
- `scripts/smoke-test.sh` checks public health, readiness, info, unauthenticated protected rejection, and optional authenticated read-only checks for dashboard summary, jobs, targets, and recent runs.
- `scripts/deploy.sh` runs pod-local liveness, pod-local readiness, and public smoke checks after rollout.
- Kubernetes readiness probe now uses `/health/readiness` while liveness/startup continue to use `/health`.

## Gate Evidence

- Added startup `SchemaReadinessService` to apply the Goal 4/5/6 additive schema readiness SQL before the app starts listening; deployed image `localhost:5000/backups-microservice:aa2f4911-dirty-20260613064342` and full authenticated smoke passed. Pod logs confirmed `Schema readiness alignment complete` before `backups-microservice running on port 3398`.
- `npm run build`: passed.
- `npm test -- --runInBand`: passed; 4 suites, 12 tests.
- `bash -n scripts/smoke-test.sh`: passed.
- `git diff --check`: passed.
- `BACKUPS_SMOKE_BASE_URL=https://backups.alfares.cz bash scripts/smoke-test.sh`: passed for health liveness, health readiness, info, and protected `/jobs` rejection with HTTP 401 before authenticated token setup.
- Generated Backups-owned smoke/internal tokens on `alfares`, patched Vault path `secret/prod/backups-microservice` for `SERVICE_TOKEN` and `JWT_TOKEN`, and forced ExternalSecret reconciliation without printing token values.
- `BACKUPS_SMOKE_TOKEN=[redacted] ./scripts/deploy.sh`: built and pushed image `localhost:5000/backups-microservice:aa2f4911-dirty-20260613063446`, applied manifests, rolled out successfully, and passed pod-local health/readiness checks. The deploy script exited non-zero on first authenticated smoke because production DB schema was missing prior Goal 6 columns.
- Applied additive schema readiness patch through the running Backups pod using `ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` for pending Goal 4/5/6 schema fields. No data deletion or restore operation was performed.
- `BACKUPS_SMOKE_TOKEN=[redacted] BACKUPS_SMOKE_BASE_URL=https://backups.alfares.cz bash scripts/smoke-test.sh`: passed health liveness, health readiness, info, unauthenticated `/jobs` HTTP 401, authenticated dashboard summary, jobs list, targets list, and recent backup runs.
- Secret scan over Goal 07 changed files found no secret values; only redaction logic and policy references matched secret-like words.

## Backup Safety Evidence

- BAK-INV-001: Scope stays in Backups operational readiness and evidence surfaces.
- BAK-INV-003: No credential values, JWTs, service tokens, private keys, or raw backup artifact paths added. Smoke auth is environment-provided and not printed.
- BAK-INV-004: Authenticated smoke confirmed dashboard summary and recent run visibility after Vault token setup and schema patch.
- BAK-INV-008: Public smoke confirmed unauthenticated `/jobs` returns HTTP 401.
- BAK-INV-009: Execution plan, context package, coding prompt, validation report, and state updates were created/updated for Goal 07.

## Passed Criteria

- Smoke test implementation and runtime validation cover health, info, protected rejection, dashboard summary, jobs, targets, and recent runs.
- Health/readiness reports database and storage readiness separately.
- Deploy script includes a meaningful post-rollout smoke check.
- Evidence log updated.

## Failed Criteria

Initial deploy smoke failed on authenticated dashboard summary because production DB schema was missing prior Goal 6 columns. The schema was patched additively and full authenticated smoke then passed.

## Deviations

- Branch deviation: work continued on `codex/backups-goal-05-coverage-model` because remote Goal 05 and Goal 06 changes are uncommitted.
- Documentation gap: `docs/orchestrator/backup-intent-plan.md` is referenced by process docs but missing in the remote repo at intake.
- Production deployment was performed after owner instruction to generate tokens and start it. The generated token values were not printed and were stored through Vault/ExternalSecret.

## Recommendation

Proceed to commit/review if requested. Production is running the Goal 7 image and full smoke passes with the generated Vault-backed service token.
