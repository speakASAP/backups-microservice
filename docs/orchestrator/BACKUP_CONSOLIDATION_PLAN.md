# Backup Consolidation Plan

Created: 2026-06-25
Owner: Alfares platform owner
Status: draft, read-only audit complete, no moves approved
Repository: `/home/ssf/Documents/Github/backups-microservice`

## Intent Preservation Chain

- Vision: Alfares runtime state must be recoverable from Git plus controlled backup artifacts without losing data or exposing secrets.
- Goal Impact: Operators use `backups-microservice` as the single control plane to see what is protected, where payloads live, when backups ran, and what remains unprotected.
- System: `backups-microservice`, second-disk mount `/srv/critical-backups`, MinIO backup bucket `backups`, `database-server`, root critical backup service, Vault/K3s/Kubernetes state, MinIO object data, and legacy backup directories.
- Feature: one controlled backup catalog and one canonical payload layout, with sanitized evidence visible through the Backups GUI.
- Task: consolidate backup payload locations and evidence contracts before adding new backup lanes.
- Execution Plan: first index and classify existing payloads; then migrate only after checksum, restore-readiness, and owner approval; never delete legacy payloads during the same step that registers or copies them.
- Coding Prompt: [MISSING: create after owner approves a specific consolidation lane].
- Code: [MISSING: no code changes in this planning pass].
- Validation: read-only evidence from `crontab`, `systemctl`, `findmnt`, `database-server` evidence JSON, Vault evidence JSON, and bounded directory listings.

## Owner Direction

Backups should not be scattered across unrelated repos and directories. The system needs one common place under operator control, with `backups-microservice` presenting one reliable view.

This plan preserves that intent with two layers:

1. Payload root: raw backup artifacts live under one second-disk filesystem.
2. Control plane: `backups-microservice` indexes sanitized evidence and presents the state in the GUI.

The Backups pod must not mount raw payload directories by default. It should read sanitized manifests only.

## Current Proven Mounts

| Path | Device | Role | Status |
| --- | --- | --- | --- |
| `/srv/critical-backups` | `/dev/md0` ext4 on degraded RAID1 over `/dev/sdb2` | Current second-disk backup filesystem | proven current candidate |
| `/mnt/alfares-db-backups` | none | Older prompt target | not mounted; do not use without reviewed mount/bind plan |
| `/mnt/md0` | none | Older unsafe path | not mounted; do not use |
| `/home/ssf/Documents/Github` | `/dev/nvme0n1p1[/github]` | Git repos and evidence files | not a raw backup payload root |
| `/` | `/dev/sda2` | live root and Kubernetes local-path volumes | not a backup destination |

## Target Common Layout

Use `/srv/critical-backups` as the physical second-disk mount and create one explicit managed root beneath it:

```text
/srv/critical-backups/alfares-dr/
  README.md
  manifest.json
  evidence/
    latest.json
    history/
  database-server/
    daily/
    restore-tests/
    legacy-index/
  host-critical/
    encrypted/
    restore-tests/
  minio/
    snapshots/
    restore-tests/
  vault/
    encrypted/
    restore-tests/
  k3s/
    encrypted/
    exports/
    restore-tests/
  pvcs/
    metadata/
    rabbitmq/
    grafana/
    prometheus/
  qdrant/
    snapshots/
    restore-tests/
  docker/
    classified/
    registry/
    ollama/
  runtime-config/
    encrypted/
  legacy/
    database-server-repo-backups/
    speakasap-repo-backups/
    opt-vault-backups/
```

Existing live directories under `/srv/critical-backups/database-server` and `/srv/critical-backups/alfares-critical` are valid second-disk payload locations, but they are not yet under the common `alfares-dr` root. Treat them as current protected inputs and migrate or bind/index them only after approval.

## Control Plane Contract

`backups-microservice` should own:

- backup source catalog;
- schedules and retention policy state;
- sanitized evidence ingestion;
- restore verification status;
- "not protected", "legacy-review", "awaiting_manifest", and "blocked" states;
- operator-visible dashboard and audit events.

`backups-microservice` should not own:

- application-domain data;
- raw database dumps inside the app repo;
- Vault secret values, unseal keys, or passphrase files;
- Kubernetes Secret `.data` values;
- production restore execution without explicit owner approval.

Sanitized evidence should remain readable by Backups through mounted manifest directories, for example:

```text
/home/ssf/Documents/Github/database-server/backup-evidence/latest.json
/home/ssf/Documents/Github/shared/runtime-evidence/vault-backups/latest.json
/home/ssf/Documents/Github/shared/runtime-evidence/minio-backups/latest.json
/home/ssf/Documents/Github/shared/runtime-evidence/k3s-backups/latest.json
/home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery/latest.json
```

Longer term, these evidence manifests can be mirrored into `/srv/critical-backups/alfares-dr/evidence/` and exposed to Backups from one read-only evidence mount.

## Current Inventory And Decision

| Current path | Current contents | Current owner | Target state | Decision | Notes |
| --- | --- | --- | --- | --- | --- |
| `/srv/critical-backups/database-server` | PostgreSQL `pg_dumpall` and Redis RDB run `20260625_190924`; about 383M | `database-server` backup lane | `/srv/critical-backups/alfares-dr/database-server/daily` | move after checksum and GUI evidence parity | Current cron writes here at `02:00`; do not move until cron and evidence are updated atomically. |
| `/srv/critical-backups/alfares-critical` | encrypted host-critical Vault/K3s/Kubernetes artifacts and recovery docs; about 36M | root critical backup service | `/srv/critical-backups/alfares-dr/host-critical/encrypted` plus possible dedicated `vault` and `k3s` subtrees | keep-indexed first, migrate only with root-service update | Root timer writes here at `02:17`; do not change while service contract still points here. |
| `/srv/critical-backups/.backup-secret` | root-only encryption passphrase copy | root critical backup service | keep root-only outside Backups GUI | do-not-touch | Never expose or copy into Git, GUI, or evidence payloads. |
| `/home/ssf/Documents/Github/database-server/backup-evidence` | sanitized database evidence JSON | `database-server` evidence lane | Backups evidence mount and optional mirror under `alfares-dr/evidence` | keep-indexed | This is safe for GUI because it excludes dump contents/secrets. |
| `/home/ssf/Documents/Github/shared/runtime-evidence/vault-backups` | sanitized critical/Vault evidence JSON | root critical backup service | Backups evidence mount and optional mirror under `alfares-dr/evidence` | keep-indexed | This is safe for GUI if manifest remains sanitized. |
| `/home/ssf/Documents/Github/database-server/backups` | legacy/default database backup run `20260625_184822`; about 383M | legacy script default | `/srv/critical-backups/alfares-dr/legacy/database-server-repo-backups` or delete after parity | legacy-review | This is on NVMe/Git repo area, not the backup disk. Do not delete until copied or declared obsolete. |
| `/home/ssf/Documents/Github/speakasap/backups` | old SpeakASAP dump | SpeakASAP legacy repo | `/srv/critical-backups/alfares-dr/legacy/speakasap-repo-backups` or owner-approved retire | legacy-review | Need owner decision whether this old dump still matters. |
| `/opt/vault/backups` | old Vault backup material from 2026-04-19 | legacy Vault lane | `/srv/critical-backups/alfares-dr/legacy/opt-vault-backups` or owner-approved retire | legacy-review | Contains sensitive material paths; copy only with root-only permissions and never expose contents. |
| MinIO bucket `backups` via `s3://backups` | Backups WAL-G target | `backups-microservice` WAL-G lane | keep as object-store backend, indexed by Backups | keep-indexed | Existing Backups intent says PostgreSQL WAL-G to MinIO remains valid unless explicitly superseded. |
| `/srv/speakasap-records` | live MinIO object data | MinIO/object storage service | `/srv/critical-backups/alfares-dr/minio/snapshots` | do-not-touch until DR-G4 dry run | This is source data, not backup payload. |
| `/srv/storagebox` | small storagebox tree, no active backup payload proven | host runtime/storage | classify under docker/runtime config lane | legacy-review | Needs separate classification before copying. |
| `/data/db-server/redis` | small Docker Redis data path | Docker Redis runtime | classify under docker/runtime config lane | legacy-review | Current Kubernetes Redis backup already exists separately. |

## Required Migration Rules

1. No deletes in the same session as first indexing or copying.
2. No `rsync --delete` until a dry run, owner review, and at least one verified target copy exist.
3. No changes to crontab, systemd timers, or Backups deployment until the target path and evidence contract are approved.
4. Every copied payload needs size, checksum, source path, target path, timestamp, and restore verification status.
5. Every moved schedule must write `.partial` first and atomically publish only after artifact validation.
6. Retention must never delete the last successful verified backup.
7. Secret material stays encrypted/root-only and is represented in GUI only by sanitized references.

## Implementation Sequence

### Phase 0 - Read-Only Catalog

Status: ready now.

Objective: create a machine-readable catalog of every known backup payload and evidence source.

Allowed outputs:

- `/home/ssf/Documents/Github/backups-microservice/docs/orchestrator/BACKUP_CONSOLIDATION_PLAN.md`
- later: `/home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery/latest.json`

Forbidden:

- moving or deleting payloads;
- changing schedules;
- mounting or remounting disks;
- exposing secret values.

Validation:

- `findmnt -T /srv/critical-backups`
- `jq .` against database and Vault evidence JSON
- read-only dashboard summary check after evidence catalog exists.

### Phase 1 - Backups GUI Catalog Support

Status: ready after Phase 0.

Objective: add a Backups dashboard section that lists backup payload families and their source of truth.

Allowed repo:

- `/home/ssf/Documents/Github/backups-microservice`

Expected behavior:

- show `database-server`, `host-critical`, `vault/k3s`, `WAL-G MinIO`, `legacy-review`, and `unprotected` states;
- show whether each payload is under the common root;
- show next action without exposing raw secret material.

Validation:

- `npm run build`
- `npm test -- --runInBand`
- `node --check web/admin/app.js`
- authenticated `/dashboard/summary` and browser check.

### Phase 2 - Database Payload Migration

Status: dependency-gated on Phase 1 and owner approval.

Objective: move database logical backups from `/srv/critical-backups/database-server` into the common root.

Target:

```text
/srv/critical-backups/alfares-dr/database-server/daily/
```

Required steps:

1. Pause only the database backup cron window or run outside `02:00`.
2. Copy existing run with checksums.
3. Update `DB_BACKUP_DIR` in cron through `database-server/scripts/setup-backup-cron.sh` or an audited crontab edit.
4. Run one manual backup.
5. Verify `gzip -t` and Redis RDB artifact.
6. Update sanitized evidence.
7. Keep old `/srv/critical-backups/database-server` as read-only legacy for at least one retention window.

Forbidden:

- deleting the old run immediately;
- restoring to production;
- changing Backups WAL-G behavior without a separate goal.

### Phase 3 - Critical Host Backup Migration

Status: dependency-gated on root-service owner approval.

Objective: update `/usr/local/sbin/alfares-critical-backup.sh` to write under the common root while preserving encrypted/root-only behavior.

Target:

```text
/srv/critical-backups/alfares-dr/host-critical/encrypted/
```

Required steps:

1. Update script constants only after a backup is not running.
2. Keep passphrase files in their current root-only locations unless owner explicitly approves a key-layout change.
3. Run the service manually once.
4. Verify checksums and encrypted archive listing without printing secret values.
5. Confirm sanitized Vault evidence still appears in Backups.

Forbidden:

- printing passphrase contents;
- moving passphrase files into Git;
- weakening root-only permissions.

### Phase 4 - Legacy Path Triage

Status: dependency-gated on owner review.

Objective: decide what to do with scattered legacy payloads.

Paths:

- `/home/ssf/Documents/Github/database-server/backups`
- `/home/ssf/Documents/Github/speakasap/backups`
- `/opt/vault/backups`

Decision options:

- copy to `/srv/critical-backups/alfares-dr/legacy/...` and mark retained;
- mark obsolete and schedule deletion after a second owner approval;
- keep in place but register as `legacy-review` until a restore owner decides.

Forbidden:

- deleting without explicit owner approval;
- copying sensitive Vault material into world-readable locations.

### Phase 5 - New Source Lanes

Status: blocked until common-root contract is accepted.

Objective: implement missing source coverage under the same root.

Targets:

- MinIO object data: `/srv/critical-backups/alfares-dr/minio/snapshots`
- Kubernetes/PVC metadata: `/srv/critical-backups/alfares-dr/k3s`, `/srv/critical-backups/alfares-dr/pvcs`
- Qdrant: `/srv/critical-backups/alfares-dr/qdrant`
- Docker runtime classification: `/srv/critical-backups/alfares-dr/docker`
- runtime config: `/srv/critical-backups/alfares-dr/runtime-config`

Each lane needs its own execution plan, dry-run validation, restore verification, and sanitized evidence manifest.

## Parallel Execution Plan

### Workstream A - Catalog And Evidence Contract

Status: ready now.

Owner role: Backups control-plane engineer.

Objective: define and publish a normalized `backup_payload_catalog` schema consumed by `backups-microservice`.

Allowed files:

- `backups-microservice/src/dashboard/**`
- `backups-microservice/web/admin/**`
- `backups-microservice/k8s/**`
- `shared/runtime-evidence/disaster-recovery/*.json`

Forbidden:

- raw payload directories;
- secret values;
- schedule mutation.

Validation owner: orchestrator.

### Workstream B - Database Root Migration

Status: dependency-gated on A and owner approval.

Owner role: database-server backup engineer.

Allowed repo:

- `/home/ssf/Documents/Github/database-server`

Shared contract:

- database evidence must report both old and new path during migration.

Merge order:

- after A schema exists; before GUI declares database path consolidated.

### Workstream C - Critical Host Backup Migration

Status: dependency-gated on A and root-service owner approval.

Owner role: root critical backup engineer.

Allowed files:

- `/usr/local/sbin/alfares-critical-backup.sh`
- `/etc/systemd/system/alfares-critical-backup.*`
- sanitized evidence under `shared/runtime-evidence/vault-backups`

Forbidden:

- passphrase exposure;
- service deletion;
- secret plaintext in manifests.

Merge order:

- after B or independently if A supports both path variants.

### Workstream D - Legacy Triage

Status: blocked on owner decision.

Owner role: archive/recovery reviewer.

Objective: decide if legacy backups are still needed.

Forbidden:

- deletion before owner-approved retirement list and checksums.

### Workstream E - Missing Large Data Lanes

Status: blocked until common root is accepted.

Owner role: object/PVC/vector backup engineer.

Objective: add MinIO, PVC, Qdrant, Docker, and runtime-config backups under the common root.

Dependencies:

- A complete;
- disk space review;
- dry-run copy plans;
- source-specific restore verification.

## Validation Checklist

Before marking consolidation complete:

- [ ] `findmnt -T /srv/critical-backups` proves `/dev/md0`.
- [ ] `/proc/mdstat` state is recorded, including degraded/healthy state.
- [ ] Backups GUI shows every known payload family.
- [ ] Backups GUI shows scattered legacy paths as `legacy-review`, not `protected`.
- [ ] Database backups write under the accepted common root or are explicitly indexed as current exception.
- [ ] Critical encrypted backups write under the accepted common root or are explicitly indexed as current exception.
- [ ] WAL-G MinIO backup state remains visible and is not silently replaced.
- [ ] No secret values appear in GUI/API/docs.
- [ ] No legacy payload is deleted until copied, verified, and separately approved.
- [ ] At least one restore verification or explicit blocker exists per source category.

## Current Recommendation

Use `/srv/critical-backups/alfares-dr` as the new common raw-payload root, but do not move the existing `database-server` or `alfares-critical` directories yet.

First implement the catalog/evidence layer so the owner can see:

- current second-disk payloads;
- object-store WAL-G payloads;
- legacy scattered payloads;
- missing lanes;
- exact next action for each item.

After that, migrate database and critical-host jobs one at a time with checksums and rollback.

## Phase 0 Catalog Evidence Contract

The Phase 0 machine-readable catalog is published at:

```text
/home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery/latest.json
```

Contract requirements:

- `schema_version` identifies the catalog schema version.
- `intent_chain` preserves Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation.
- `safety_policy` records that the catalog contains sanitized metadata only and excludes secret values, dump contents, Kubernetes Secret `.data`, and encrypted archive contents.
- `mounts` records proven storage roots and degraded/blocked infrastructure state from read-only checks.
- `payload_families` records each known current, keep-indexed, legacy-review, do-not-touch, or live-source path with owner, decision, target state, restore verification status, checksum status, and allowed next action.
- `missing_or_awaiting_manifest_lanes` records backup families that Backups must not present as protected until sanitized manifests exist.
- `phase0_validation` records commands and blockers used to create the catalog.

The catalog is evidence for GUI/catalog work only. It is not approval to move, delete, copy, restore, mount, remount, change schedules, expose raw payloads, or read secret material.
