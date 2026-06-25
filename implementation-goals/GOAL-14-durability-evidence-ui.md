# GOAL-14 - Durability Evidence UI

## Objective

Show operator-visible evidence that infrastructure database exports and Vault recovery coverage exist, without exposing backup payloads, passwords, keys, tokens, or raw secret material.

## Upstream Intent

- `docs/orchestrator/INTENT.md`: Backups is the disaster-recovery control plane and must show whether sources are protected.
- `docs/orchestrator/backup-intent-plan.md`: future coverage includes PostgreSQL databases, Kubernetes resources, PVCs, and Vault/secret references.
- Owner request on 2026-06-25: after login, the frontend must show database backups and coordinate with a parallel Vault backup stream.

## Scope

Allowed files:

- `src/dashboard/dashboard.service.ts`
- `web/admin/index.html`
- `web/admin/app.js`
- `web/admin/styles.css`
- `k8s/deployment.yaml`
- `implementation-goals/GOAL-14-durability-evidence-ui.md`

Forbidden files:

- `BUSINESS.md`
- `GOALS.md`
- secret files, `.env`, Kubernetes Secret values, Vault payloads

## Acceptance Criteria

- Dashboard summary includes sanitized external evidence for `database-server`.
- Dashboard summary includes a separate Vault evidence slot that can read a sanitized JSON manifest when the parallel Vault worker writes it.
- Admin dashboard renders database backup evidence and Vault evidence after login.
- UI does not show dump contents, WAL-G output, secret values, unseal keys, tokens, or passwords.
- Kubernetes deployment mounts only sanitized evidence directories read-only.
- Existing protected API behavior remains unchanged.

## Parallel Execution

- Workstream A: database export script writes `backup-evidence/latest.json`; ready now; owner: database-server agent.
- Workstream B: Backups dashboard reads and renders sanitized evidence; ready now; owner: Backups UI/API agent.
- Workstream C: Vault backup worker writes `/home/ssf/Documents/Github/shared/runtime-evidence/vault-backups/latest.json`; active elsewhere; owner: Vault worker.
- Integration owner: this thread.
- Validation owner: this thread.
- Merge order: A -> B -> C evidence file appears independently.

## Validation Plan

Run `npm run build`, `npm test -- --runInBand`, `node --check web/admin/app.js`, `git diff --check`, authenticated smoke, and browser/UI verification after deployment.
