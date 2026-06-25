# GOAL-15 - Disaster Recovery Catalog UI

## Objective

Show the Phase 0 disaster-recovery catalog in the Backups dashboard so operators can see current backup payload families, keep-indexed evidence sources, legacy-review paths, missing lanes, and allowed next actions before any migration.

## Upstream Intent

- `docs/orchestrator/INTENT.md`: Backups is the disaster-recovery control plane and must show what is protected, what is unprotected, and what operator action is required.
- `docs/orchestrator/BACKUP_CONSOLIDATION_PLAN.md`: Phase 1 is ready after Phase 0 and must list backup payload families and their source of truth without exposing raw secret material.
- `/home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery/latest.json`: Phase 0 sanitized catalog evidence source.

## Scope

Allowed files:

- `src/dashboard/dashboard.service.ts`
- `web/admin/index.html`
- `web/admin/app.js`
- `web/admin/styles.css`
- `k8s/deployment.yaml`
- `test/dashboard-catalog.spec.ts`
- `implementation-goals/GOAL-15-disaster-recovery-catalog-ui.*`
- `implementation-goals/README.md`
- `docs/IMPLEMENTATION_STATE.md`
- `STATE.json`
- `TASKS.md`

Forbidden files:

- `BUSINESS.md`
- `GOALS.md`
- raw backup payloads under `/srv/critical-backups`, `/opt/vault/backups`, or service repo backup directories
- crontab, systemd timers, mounts, fstab, Kubernetes Secrets, Vault payloads, and backup scripts

## Acceptance Criteria

- `/dashboard/summary` includes a sanitized `external_evidence.disaster_recovery_catalog` object when the Phase 0 catalog manifest is mounted/readable.
- The API does not expose secret values, dump contents, Kubernetes Secret `.data`, encrypted archive contents, or root-only secret material paths.
- Admin dashboard renders catalog families with category, current source reference, target state, restore/checksum status, and next action.
- Admin dashboard renders missing/awaiting-manifest lanes separately.
- Kubernetes deployment mounts only the sanitized disaster-recovery evidence directory read-only.
- Existing auth behavior remains unchanged.

## Parallel Execution

- Workstream A: API sanitizer and summary contract; ready now; owner: this session.
- Workstream B: Admin dashboard rendering; ready now but edits shared UI files with A, so keep in same session.
- Workstream C: Kubernetes read-only evidence mount; ready now; owner: this session.
- Integration owner: this session.
- Validation owner: this session.
- Merge order: A -> B -> C -> validation/state update.

## Validation Plan

Run `npm run build`, `npm test -- --runInBand`, `node --check web/admin/app.js`, `git diff --check`, `jq . /home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery/latest.json`, and an unauthenticated `/dashboard/summary` check. Authenticated browser verification remains deployment-gated because no deploy is approved in this session.
