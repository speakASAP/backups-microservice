# VAL-BAK-15: Disaster Recovery Catalog UI

```yaml
id: VAL-BAK-15
status: deployed
validated_artifact: implementation-goals/GOAL-15-disaster-recovery-catalog-ui.md
owner: validator
created: 2026-06-25
last_updated: 2026-06-25
```

## Artifact Validated

BAK-G15 Disaster Recovery Catalog UI on branch `codex/backups-phase1-catalog-support`.

## Validation Scope

Validated additive API/UI support for sanitized Phase 0 disaster-recovery catalog evidence, read-only Kubernetes manifest mount configuration, and catalog sanitizer behavior.

## Evidence

- `/dashboard/summary` now includes `external_evidence.disaster_recovery_catalog`.
- The sanitizer returns payload families, missing lanes, mount metadata, and safety flags from the Phase 0 catalog.
- Do-not-touch secret-material path references are redacted as `[REDACTED: do-not-touch secret material path]`.
- Admin dashboard renders a disaster-recovery catalog panel under Disk backup evidence.
- Kubernetes deployment adds a read-only mount for `/home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery`.
- Public unauthenticated route check returned `401` with `Missing Authorization header`.

## Gate Evidence

- `npm run build` passed.
- `npm test -- --runInBand` passed: 12 suites, 39 tests.
- `node --check web/admin/app.js` passed.
- `git diff --check` passed.
- `jq . /home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery/latest.json` passed; catalog contains 12 payload families and 5 missing lanes.
- `kubectl apply --dry-run=client -f k8s/deployment.yaml` passed with `deployment.apps/backups-microservice configured (dry run)`.
- `curl -k https://backups.alfares.cz/dashboard/summary` without auth returned HTTP 401.

## Backup Safety Evidence

- No raw backup payloads were read, copied, moved, deleted, restored, or listed.
- No cron, systemd timer, mount, fstab, Secret, Vault payload, or backup script was changed.
- No deploy, commit, or push was performed.
- Catalog safety policy reports `raw_payload_contents_included=false`, `secret_values_included=false`, `kubernetes_secret_data_included=false`, `encrypted_archive_contents_included=false`, `destructive_actions_performed=false`, and `schedule_or_mount_changes_performed=false`.

## Passed Criteria

- Additive API evidence contract implemented.
- Admin dashboard catalog rendering implemented.
- Missing/awaiting-manifest lanes rendered separately.
- Read-only deployment mount configured and dry-run validated.
- Focused sanitizer test added and full suite passed.
- Existing auth boundary remains in place.

## Failed Criteria

None.

## Deviations

Authenticated browser/UI runtime verification was not run because no deployment was approved or performed in this session. In-pod `wget` is unavailable, so the unauthenticated boundary was verified through the existing public route instead.

## Recommendation

Review and, after owner approval, deploy this branch so the live Backups dashboard can read the mounted Phase 0 disaster-recovery catalog.
