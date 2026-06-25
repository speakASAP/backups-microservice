# Second Disk Disaster Recovery Orchestrator Prompt

Created: 2026-06-25
Owner: Alfares platform owner
Target server: `alfares`
Primary repo for orchestration evidence: `/home/ssf/Documents/Github/backups-microservice`
Related repos: `database-server`, `vault-microservice`, `minio-microservice`, `monitoring-microservice`, `docs-rag-microservice`, `shared`, `k8s-manifests`

## Revalidation Corrections - 2026-06-25 19:31 CEST

This section supersedes any older command examples below when they conflict with current live evidence.

Read-only revalidation on `alfares` showed:

- `/dev/md0` is already mounted read-write at `/srv/critical-backups`.
- `/srv/critical-backups` is on `/dev/md0`, ext4, and is not `/dev/sda2` or `/dev/nvme0n1p1`.
- `/dev/md0` is a degraded RAID1 over `/dev/sdb2`; `/dev/md1` is a separate 1G RAID1 over `/dev/sdb1`.
- `/srv/critical-backups` already contains existing root-like filesystem content, `.backup-secret`, `alfares-critical`, and `database-server/20260625_190924`.
- `/mnt/alfares-db-backups` and `/mnt/md0` are not currently proven mountpoints and must not be assumed safe.

Execution corrections:

1. Start strictly with the no-write disk proof commands from DR-G0/DR-G1. Do not create the baseline file until after the no-write proof has been reviewed.
2. Do not run `mount /dev/md0 ...` while `/dev/md0` is already mounted at `/srv/critical-backups`. First reconcile the existing mount, fstab state, intended backup root, and owner approval.
3. Treat `/srv/critical-backups` as the current candidate second-disk mount. Use a variable such as `DR_BACKUP_MOUNT=/srv/critical-backups` and `DR_BACKUP_ROOT=$DR_BACKUP_MOUNT/alfares-dr` in later commands after owner approval.
4. If a different path such as `/mnt/alfares-db-backups` is still desired, use it only after explicit owner approval and a reviewed mount/bind-mount plan. Do not unmount or remount `/dev/md0` without approval and blast-radius review.
5. If any future read-only mount of an unmounted candidate filesystem is required, use filesystem-aware non-replay options when possible, for example `ro,noload` for ext filesystems or `ro,norecovery` for XFS. Do not mount read-write for inspection.
6. The `database-server` second-disk `pg_dumpall`/Redis evidence path is a disaster-recovery supplement. It must not silently replace the existing Backups WAL-G-to-MinIO contract in `docs/orchestrator/INTENT.md`; any replacement or deprecation of WAL-G behavior requires an explicit goal artifact and intent update.
7. Before source-code changes, create or update a numbered DR implementation goal and its execution-plan, context, coding-prompt, and validation artifacts according to `docs/process/INTENT_PRESERVATION_SYSTEM.md`, `docs/process/OPERATIONAL_GATES.md`, and `implementation-goals/README.md`.
8. No parallel worker may write backup payloads, schedules, GUI claims, or evidence contracts until Workstream A records the accepted second-disk root and handoff contract.

## Purpose

This document is a full prompt and execution plan for a new root-capable orchestrator. The orchestrator must organize safe disaster-recovery backups for the Alfares host onto a second physical disk, repair and extend `backups-microservice` so operators can see backup/restore state in the GUI, and verify restores without risking current production data.

The owner's non-negotiable priorities are:

1. No current production data may be lost.
2. No production database, MinIO bucket, Vault store, Kubernetes state, or live service may be destroyed, overwritten, reformatted, or restored in place without explicit owner approval.
3. Backups must be stored on a different physical disk from the live data.
4. The backup system must be visible and manageable from `https://backups.alfares.cz` for the owner's test user.
5. Restore checks must run in isolated restore locations, temporary databases, disposable namespaces, or non-production folders only.
6. Secrets must be backed up safely but never exposed in source code, logs, GUI, chat output, Git commits, or durable plain-text reports.

## Copy/Paste Prompt For The New Orchestrator

```text
You are the root-capable Alfares disaster-recovery orchestrator.

Your mission is to implement safe second-disk disaster-recovery backups for all important Alfares runtime data, then update `backups-microservice` so the owner can log into the GUI and see backup coverage, schedules, latest runs, failures, restore verification evidence, and explicit safety state.

Server:
- SSH alias: alfares
- Remote repo base: /home/ssf/Documents/Github/<repository>
- Work remote-only. Do not save Alfares project files under /Users/Sergej.Stasok/Documents.

Company standard:
- Preserve the Intent Preservation chain:
  Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation
- Mark unavailable facts as [MISSING: ...] or [UNKNOWN: ...].
- Do not invent contracts, approvals, passwords, mount state, backup success, or restore evidence.

Hard safety rules:
- Never format, repartition, wipe, delete, or run `rm -rf` against any disk, mountpoint, Kubernetes PVC, Docker volume, MinIO path, Vault path, or database unless the owner gives explicit approval in the current session after you show the exact command and blast radius.
- Never run production restore in place unless the owner explicitly approves it in the current session.
- Never stop `k3s`, PostgreSQL, Vault, MinIO, Docker, or Traefik unless the owner explicitly approves downtime.
- Never echo, print, commit, upload, or persist root password, database passwords, Vault tokens, unseal keys, JWT secrets, MinIO secret keys, or Kubernetes secret values.
- Never put secret values in the Backups GUI. The GUI may show secret references, checksum status, backup age, restore verification state, and redacted metadata only.
- Root password may be used only interactively for `sudo` or root shell elevation. Do not write it to files, scripts, shell history, logs, environment files, or chat.
- Treat `/mnt/md0` as unsafe until `findmnt /mnt/md0` proves it is a real mountpoint. Previous evidence showed `/mnt/md0` was only a directory on `/dev/sda2`, not the second disk.
- Treat `/dev/sdb`, `/dev/md0`, and `/dev/md1` as potentially containing existing data. Mount read-only first and inspect. Do not format.
- If any command output suggests ambiguity about disk identity, mount identity, or backup destination, stop and report [BLOCKED: second disk identity not proven].

Current known facts from the 2026-06-25 read-only audit:
- k3s is running on single node `alfares`.
- Main namespace is `statex-apps`.
- Live root and Kubernetes local-path volumes are on `/dev/sda2`.
- `/home/ssf/Documents/Github` and `/mnt/docker-data` are on `/dev/nvme0n1p1`.
- `/dev/sdb` exists as degraded RAID member backing `/dev/md0` and `/dev/md1`; `/mnt/md0` was not a mountpoint at audit time.
- PostgreSQL runs as `statex-apps/deploy/db-server-postgres` with PVC `db-server-postgres-pvc`.
- Redis runs as `statex-apps/deploy/db-server-redis` with PVC `db-server-redis-pvc`; Redis AOF was disabled.
- MinIO in Kubernetes uses hostPath `/srv/speakasap-records`, not a PVC.
- Vault runs in Docker and uses `/opt/vault/data` plus Docker volumes.
- External Secrets uses `ClusterSecretStore/vault-backend`; Vault is the source of truth for many Kubernetes secrets.
- Qdrant uses hostPath `/home/ssf/Documents/Github/docs-rag-microservice/qdrant-storage`.
- `backups-microservice` had nightly jobs, but previous WAL-G runs were failing with `unknown command "pgbackup"` and must be re-verified before claiming protection.
- `database-server` contains `scripts/backup-all-databases.sh`, `scripts/setup-backup-cron.sh`, and `docs/orchestrator/SECOND_DISK_DR_RUNBOOK.md`.
- `vault-microservice` contains `scripts/backup-cron.sh`, but previous crontab did not show active Vault backup scheduling.

Your work must be goal-driven. Execute one goal at a time, with evidence before and after. Use subagents for independent lanes when they do not mutate the same files or shared contracts. Keep orchestration/integration decisions in the main thread.

Required final state:
- A verified second-disk backup root exists and is proven with `findmnt`.
- PostgreSQL and Redis backups are generated on the second disk on a schedule and can be restored to isolated test targets.
- MinIO/object storage backup is generated on the second disk on a schedule and can be sample-restored to an isolated folder.
- Vault file storage and recovery material are backed up using encrypted/secret-safe handling and have sanitized evidence.
- Kubernetes cluster metadata and resource manifests are exported on a schedule without leaking secret values.
- Qdrant/vector-store state is backed up or rebuild coverage is explicitly documented and visible.
- Docker host-level runtime state that is not recoverable from GitHub is backed up or explicitly classified.
- `backups-microservice` GUI shows coverage, schedules, last successful backup, last failure, restore verification evidence, backup destination state, and protection gaps.
- The owner can log in with the test user and see the system state in the GUI.
- No restore has touched production data.
```

## Intent Preservation Chain

Vision: Alfares services must survive loss of one disk or the whole host without losing user data, object files, secrets, cluster identity, or operational recovery evidence.

Goal Impact: The owner can restore applications from GitHub plus second-disk backups and can see current backup health in the Backups GUI.

System: Alfares single-node k3s, Docker host services, PostgreSQL, Redis, MinIO, Vault, External Secrets, local-path PVCs, Qdrant, and `backups-microservice`.

Feature: second-disk disaster-recovery backup and restore-verification control plane.

Task: safely mount and use a second physical disk, implement scheduled backups for critical runtime data, repair backup execution failures, add GUI-managed coverage and evidence, and verify restores in isolation.

Execution Plan: follow the goal sequence below; each goal has safety gates, allowed mutations, validation evidence, rollback/stop rules, and handoff notes.

Coding Prompt: this document is the coding/orchestration prompt for the root-capable orchestrator.

Code: [MISSING: to be implemented by the new orchestrator].

Validation: [MISSING: to be gathered by the new orchestrator through backup artifact checks, restore drills, GUI smoke tests, and non-destructive runtime verification].

## Non-Negotiable Safety Gates

### Gate S0 - Root Password Handling

Allowed:
- Use `sudo -v` or an interactive root shell after the owner provides the password.
- Use root to run read-only disk/mount inspection.
- Use root to mount a known filesystem after read-only proof.
- Use root to create backup directories and set ownership/mode.

Forbidden:
- Storing the root password in any file, environment variable, shell script, command history, Git repo, log, or GUI.
- Pasting the root password into a command that could be logged.
- Printing secret values in reports.

Validation evidence:
- Report: "Root credential was used only interactively; no password value was persisted."

### Gate S1 - Disk Identity Proof Before Writes

Before writing to any second-disk path, collect:

```bash
ssh alfares 'hostname && date && whoami'
ssh alfares 'df -hT'
ssh alfares 'lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,UUID,MOUNTPOINTS,MODEL,SERIAL'
ssh alfares 'cat /proc/mdstat'
ssh alfares 'findmnt -rno TARGET,SOURCE,FSTYPE,OPTIONS'
ssh alfares 'sudo blkid /dev/sdb* /dev/md0 /dev/md1 2>/dev/null || true'
ssh alfares 'sudo mdadm --detail /dev/md0 /dev/md1 2>/dev/null || true'
```

Rules:
- If `/mnt/md0` points to `/dev/sda2`, it is not the second disk.
- If `/dev/md0` cannot be proven mountable, stop.
- If `/dev/md0` contains an existing OS or data, do not delete it.
- Mount read-only first.

Suggested safe inspection:

```bash
sudo mkdir -p /mnt/alfares-dr-inspect
sudo mount -o ro /dev/md0 /mnt/alfares-dr-inspect
findmnt /mnt/alfares-dr-inspect
sudo ls -lah /mnt/alfares-dr-inspect | sed -n '1,80p'
sudo umount /mnt/alfares-dr-inspect
```

If read-only mount succeeds and owner approves using that filesystem for backups, mount it read-write at a dedicated backup mountpoint:

```bash
sudo mkdir -p /mnt/alfares-db-backups
sudo mount /dev/md0 /mnt/alfares-db-backups
findmnt /mnt/alfares-db-backups
sudo mkdir -p /mnt/alfares-db-backups/alfares-dr
sudo chmod 700 /mnt/alfares-db-backups/alfares-dr
```

Do not edit `/etc/fstab` until a manual mount, write test, backup run, and reboot-risk review pass.

### Gate S2 - No Destructive Restore

All restore tests must use isolated targets:
- PostgreSQL: temporary database names like `restore_verify_<timestamp>` or disposable local container/namespace.
- Redis: restore to temporary file and inspect with `redis-check-rdb` or a disposable Redis instance, not production `db-server-redis`.
- MinIO: restore/sample copy to `/mnt/alfares-db-backups/alfares-dr/restore-tests/minio/<timestamp>` or another isolated directory.
- Vault: verify encrypted archive integrity and list expected redacted metadata; do not overwrite `/opt/vault/data`.
- Kubernetes: dry-run apply to a temporary namespace or validate exported YAML structurally; do not replace live resources.
- Qdrant: restore to an isolated folder or container; do not overwrite live `qdrant-storage`.

### Gate S3 - Secret Redaction

The orchestrator may read secrets when needed for Alfares recovery work, but durable outputs must contain only:
- secret name/reference;
- namespace/path;
- key names, if not sensitive in themselves;
- checksum of encrypted backup artifact;
- restore status;
- age and size;
- "redacted" placeholders.

Forbidden in durable outputs:
- secret values;
- Vault root token;
- Vault unseal key;
- database passwords;
- MinIO secret key;
- JWT signing secret;
- API tokens;
- private keys.

### Gate S4 - Backup Success Definition

A backup is not "successful" until all are true:
- artifact exists on the second disk;
- artifact checksum is recorded;
- artifact has nonzero size;
- artifact passes format validation (`gzip -t`, `tar -tzf`, `pg_restore --list`, `jq`, etc.);
- restore verification was executed or a clear `verification_status=not_supported_yet` with a tracked follow-up exists;
- sanitized evidence is visible to `backups-microservice`;
- GUI displays the state correctly.

## Required Backup Source Inventory

### Critical Sources

1. PostgreSQL databases
   - Runtime: `statex-apps/deploy/db-server-postgres`
   - Current PVC: `statex-apps/db-server-postgres-pvc`
   - Backup method: logical `pg_dumpall` plus per-database restore tests; optional physical/PVC copy later.
   - Restore target: temporary PostgreSQL database or disposable PostgreSQL container.
   - GUI class: `postgres_database`.

2. Redis
   - Runtime: `statex-apps/deploy/db-server-redis`
   - Current PVC: `statex-apps/db-server-redis-pvc`
   - Known risk: AOF disabled in previous audit.
   - Backup method: `redis-cli --rdb` artifact plus integrity check.
   - Restore target: disposable Redis instance or `redis-check-rdb`.
   - GUI class: `redis_database` or `pvc` until model extension.

3. MinIO/object storage
   - Runtime: `statex-apps/deploy/minio-microservice`
   - Current data path: `/srv/speakasap-records`
   - Known buckets/directories: `speakasap-records`, `school-committee`, `catalog-media`, `.minio.sys`.
   - Backup method: filesystem-level `rsync`/`restic`/`rclone` to second disk, preserving metadata; record checksums/sample file count.
   - Restore target: isolated restore folder.
   - GUI class: `minio_bucket`.

4. Vault and secret recovery material
   - Runtime: Docker container `vault-microservice`
   - Data path: `/opt/vault/data`
   - Backup path found previously: `/opt/vault/backups`
   - Critical file: `/home/ssf/Documents/Github/vault-microservice/.vault-init`
   - Backup method: encrypted tar/archive or Vault-supported snapshot method appropriate to storage backend; `.vault-init` must be encrypted and access-controlled.
   - Restore target: isolated folder/container only.
   - GUI class: `secret_reference`.

5. Kubernetes cluster metadata and manifests
   - Runtime: k3s.
   - Source paths: `/etc/rancher/k3s`, `/var/lib/rancher/k3s/server`, selected sanitized `kubectl get ... -o yaml` exports.
   - Backup method: root-only archive of k3s identity/config plus sanitized resource exports; secret values redacted or excluded unless inside encrypted secret-safe backup.
   - Restore target: dry-run validation, not production apply.
   - GUI class: `kubernetes_resource`.

6. Kubernetes PVCs
   - Current PVCs: PostgreSQL, Redis, RabbitMQ, Prometheus, Grafana.
   - Backup method: prefer application-aware logical backups for PostgreSQL/Redis; file-level backup for RabbitMQ/Grafana/Prometheus if needed; record PVC metadata.
   - Restore target: isolated directories or test namespace.
   - GUI class: `pvc`.

7. Qdrant/vector store
   - Runtime: `statex-apps/deploy/qdrant`
   - Current hostPath: `/home/ssf/Documents/Github/docs-rag-microservice/qdrant-storage`
   - Backup method: Qdrant snapshot if available or filesystem copy while ensuring consistency; otherwise mark rebuild-from-source and backup source documents.
   - Restore target: isolated folder/container.
   - GUI class: `vector_store`.

8. Docker host-level runtime state
   - Runtime: Docker containers outside k3s: Vault, local registry, LiteLLM, Ollama, Docker Redis, platform management, rehtani.
   - Important paths from previous audit:
     - `/mnt/docker-data/docker`
     - Docker volume `ai-microservice_ollama-data-green`
     - Docker volume `vault-microservice_vault-data`
     - `/srv/storagebox/...`
     - `/data/db-server/redis`
     - local registry bind `/srv/storagebox/statex/docker-volumes/k8s-registry`
   - Backup method: classify each as recoverable, rebuildable, or critical; back up critical non-rebuildable data.
   - GUI class: `docker_runtime`.

9. Ignored runtime configuration
   - Examples from previous audit:
     - `ai-microservice/.env*`
     - `minio-microservice/.env*`
     - `statex/.env*`
     - `database-server/.env*`
     - `vault-microservice/.vault-init`
   - Backup method: encrypted secrets/config archive, never Git.
   - GUI class: `secret_reference` or `runtime_config`.

## Backup Destination Layout

Use a single root under the verified second disk:

```text
/mnt/alfares-db-backups/alfares-dr/
  README.md
  manifest.json
  locks/
  logs/
  evidence/
    latest.json
    history/
  postgres/
    daily/
    weekly/
    restore-tests/
  redis/
    daily/
    restore-tests/
  minio/
    snapshots/
    restore-tests/
  vault/
    encrypted/
    restore-tests/
  k3s/
    exports/
    encrypted/
    restore-tests/
  pvcs/
    rabbitmq/
    prometheus/
    grafana/
    metadata/
  qdrant/
    snapshots/
    restore-tests/
  docker/
    registry/
    ollama/
    classified/
  runtime-config/
    encrypted/
```

Recommended permissions:

```bash
sudo chown -R root:root /mnt/alfares-db-backups/alfares-dr
sudo chmod 700 /mnt/alfares-db-backups/alfares-dr
sudo mkdir -p /home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery
sudo chown -R ssf:ssf /home/ssf/Documents/Github/shared/runtime-evidence
sudo chmod 750 /home/ssf/Documents/Github/shared/runtime-evidence
```

Expose only sanitized evidence to `backups-microservice`, for example:

```text
/home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery/latest.json
/home/ssf/Documents/Github/database-server/backup-evidence/latest.json
/home/ssf/Documents/Github/shared/runtime-evidence/vault-backups/latest.json
/home/ssf/Documents/Github/shared/runtime-evidence/minio-backups/latest.json
/home/ssf/Documents/Github/shared/runtime-evidence/k3s-backups/latest.json
```

Do not expose raw backup payload directories through the GUI pod.

## Goal-Driven Development Plan

### Goal DR-G0 - Current State Freeze And Evidence Baseline

Status: ready now.

Objective:
Collect a read-only baseline before any root operation or code change.

Allowed actions:
- SSH read-only inspection.
- `kubectl get` and `docker ps/inspect`.
- PostgreSQL read-only inventory.
- Read existing docs and scripts.

Forbidden actions:
- Any writes.
- Any restart.
- Any restore.
- Any secret value printing.

Commands:

```bash
ssh alfares 'hostname && date && whoami && pwd'
ssh alfares 'df -hT && lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,UUID,MOUNTPOINTS,MODEL,SERIAL'
ssh alfares 'cat /proc/mdstat'
ssh alfares 'findmnt -rno TARGET,SOURCE,FSTYPE,OPTIONS | sort'
ssh alfares 'kubectl get nodes -o wide'
ssh alfares 'kubectl get pods,svc,ingress,pvc,pv -A -o wide'
ssh alfares 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"'
ssh alfares 'docker volume ls'
ssh alfares 'crontab -l 2>/dev/null || true'
ssh alfares 'systemctl list-timers --all --no-pager | egrep -i "backup|snapshot|dump|borg|restic|rsync|kopia|duplicati|rclone|pg" || true'
```

PostgreSQL inventory:

```bash
ssh alfares 'kubectl -n statex-apps exec deploy/db-server-postgres -- sh -lc '"'"'psql -U "$POSTGRES_USER" -d postgres -Atc "select datname, pg_size_pretty(pg_database_size(datname)) from pg_database where datistemplate=false order by datname;"'"'"''
```

Acceptance criteria:
- Baseline report exists in `backups-microservice/docs/orchestrator/DR-BASELINE-<timestamp>.md`.
- Current dirty Git state is recorded and unrelated changes are not touched.
- Current backup failures are captured exactly.

### Goal DR-G1 - Prove And Mount The Second Disk Safely

Status: ready after DR-G0.

Objective:
Prove a backup destination is on a different physical disk, mount it safely, and create a backup root without formatting or destroying anything.

Allowed actions:
- Read-only disk inspection.
- Read-only mount of `/dev/md0` or confirmed second-disk filesystem.
- Owner-approved read-write mount.
- Create backup directories only after mount proof.

Forbidden actions:
- `mkfs`, `fdisk`, `parted`, `wipefs`, `mdadm --create`, `dd`, `rm -rf`.
- Writing to `/mnt/md0` before it is proven to be a second-disk mount.
- Editing `/etc/fstab` before manual mount validation.

Execution:

1. Inspect disks with root.
2. Mount candidate read-only.
3. Show owner the identity, filesystem, existing contents, available space, and mount proof.
4. If owner confirms use of that filesystem, mount read-write at `/mnt/alfares-db-backups`.
5. Create `/mnt/alfares-db-backups/alfares-dr`.
6. Write a tiny non-secret test file, sync, read it back, delete only that test file.
7. Record evidence.

Validation:

```bash
findmnt /mnt/alfares-db-backups
df -hT /mnt/alfares-db-backups
stat -c '%U %G %a %n' /mnt/alfares-db-backups/alfares-dr
```

Stop conditions:
- Mount source is `/dev/sda2` or `/dev/nvme0n1p1`.
- `/dev/md0` identity is unclear.
- Filesystem has unexpected important data and owner has not approved sharing it as a backup destination.

### Goal DR-G2 - Implement Non-Destructive PostgreSQL And Redis Backups To Second Disk

Status: ready after DR-G1.

Objective:
Create verified logical database exports on the second disk, using the existing `database-server` scripts where possible.

Allowed files:
- `/home/ssf/Documents/Github/database-server/scripts/backup-all-databases.sh`
- `/home/ssf/Documents/Github/database-server/scripts/backup-database.sh`
- `/home/ssf/Documents/Github/database-server/scripts/setup-backup-cron.sh`
- `/home/ssf/Documents/Github/database-server/docs/orchestrator/*.md`
- sanitized evidence under `/home/ssf/Documents/Github/database-server/backup-evidence`

Forbidden files:
- PostgreSQL data directory.
- Redis PVC directory.
- Production database contents except read-only dump operations.
- Secret values in docs.

Execution:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/database-server && DB_BACKUP_DIR=/mnt/alfares-db-backups/alfares-dr/postgres/daily DB_BACKUP_EVIDENCE_DIR=/home/ssf/Documents/Github/database-server/backup-evidence DB_BACKUP_RETENTION_DAYS=14 ./scripts/backup-all-databases.sh'
```

The script should create:
- compressed `pg_dumpall`;
- compressed Redis RDB;
- database list;
- manifest;
- sanitized evidence JSON.

If the existing script is insufficient:
- patch it conservatively;
- add locking with `flock`;
- ensure `set -euo pipefail`;
- write to a temporary `.partial` file and rename atomically only after validation;
- never delete the current/latest successful backup when a new backup fails.

Validation:

```bash
find /mnt/alfares-db-backups/alfares-dr/postgres/daily -maxdepth 2 -type f -name '*.gz' -exec gzip -t {} \;
jq . /home/ssf/Documents/Github/database-server/backup-evidence/latest.json
```

Restore verification:
- Create an isolated restore directory.
- Restore PostgreSQL dump into a temporary PostgreSQL instance or temporary database only.
- Restore Redis RDB to a disposable Redis container or validate file format.
- Record verification result in sanitized evidence.

Acceptance criteria:
- One manual backup succeeds.
- One isolated restore verification succeeds or has a documented non-production blocker.
- Cron is installed only after manual backup succeeds.
- `crontab -l` shows the scheduled command.

### Goal DR-G3 - Repair `backups-microservice` PostgreSQL Backup Execution

Status: ready after DR-G0; can run in parallel with DR-G1/DR-G2 until integration, but must not deploy before validation.

Objective:
Fix the false-success/failed-backup state in `backups-microservice`, where previous WAL-G jobs failed with `unknown command "pgbackup"`.

Allowed files:
- `backups-microservice/src/**`
- `backups-microservice/test/**`
- `backups-microservice/web/admin/**`
- `backups-microservice/k8s/**`
- `backups-microservice/docs/orchestrator/**`
- `backups-microservice/implementation-goals/**`

Forbidden actions:
- Backup deletion.
- Production restore.
- Secret logging.
- Changing unrelated UI work without reading the dirty files first.

Required investigation:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/backups-microservice && rg -n "pgbackup|wal-g|WALG|backup-push|pg_dump|pg_dumpall" src test k8s scripts'
ssh alfares 'kubectl -n statex-apps exec deploy/backups-microservice -- sh -lc "command -v wal-g && wal-g --help | sed -n '"'"'1,120p'"'"'"'
ssh alfares 'kubectl -n statex-apps exec deploy/backups-microservice -- sh -lc "command -v pg_dumpall || true; command -v pg_dump || true"'
```

Possible safe fixes:
- Replace unsupported WAL-G `pgbackup` path with a supported logical dump path if current WAL-G build does not support it.
- Use `database-server` backup evidence as the source of truth for second-disk PostgreSQL backup, while Backups GUI manages schedules and evidence.
- Add clear failure state when the configured backend is unavailable.

Acceptance criteria:
- A failed WAL-G job no longer looks operationally protected.
- The GUI exposes the backend error and next action.
- A successful second-disk database backup appears in dashboard summary.
- Tests cover unsupported WAL-G command handling or replacement path.

Validation:

```bash
ssh alfares 'cd /home/ssf/Documents/Github/backups-microservice && npm run build'
ssh alfares 'cd /home/ssf/Documents/Github/backups-microservice && npm test -- --runInBand'
ssh alfares 'cd /home/ssf/Documents/Github/backups-microservice && node --check web/admin/app.js'
ssh alfares 'cd /home/ssf/Documents/Github/backups-microservice && git diff --check'
```

Deployment:
- Deploy only after validation.
- Use `/home/ssf/Documents/Github/backups-microservice/scripts/deploy.sh`.
- Run authenticated and unauthenticated smoke checks.

### Goal DR-G4 - Implement MinIO/Object Storage Backup And Sample Restore

Status: ready after DR-G1.

Objective:
Back up `/srv/speakasap-records` to the second disk and show sanitized MinIO backup evidence in GUI.

Allowed actions:
- Read-only bucket/object inventory.
- Non-destructive copy/sync to second disk.
- Sample restore to isolated folder.

Forbidden actions:
- Deleting source MinIO objects.
- Running destructive `rsync --delete` until a non-delete dry run and owner approval exist.
- Modifying `.minio.sys` in production.

Recommended first implementation:
- Use `rsync -aHAX --numeric-ids --info=stats2` from `/srv/speakasap-records/` to `/mnt/alfares-db-backups/alfares-dr/minio/snapshots/current/`.
- For retention, rotate snapshot directories or use `rsync --link-dest` after validating the first copy.
- If `restic`/`borg` is installed and approved, encrypted snapshots may be better. Do not install new packages without owner approval if package installation is not already part of the plan.

Dry-run first:

```bash
sudo rsync -aHAXn --numeric-ids --info=stats2 /srv/speakasap-records/ /mnt/alfares-db-backups/alfares-dr/minio/snapshots/current/
```

Then real copy only after reviewing dry-run summary:

```bash
sudo rsync -aHAX --numeric-ids --info=stats2 /srv/speakasap-records/ /mnt/alfares-db-backups/alfares-dr/minio/snapshots/current/
```

Validation:
- Compare object counts.
- Compare total size.
- Sample restore one or more files to `/mnt/alfares-db-backups/alfares-dr/minio/restore-tests/<timestamp>/`.
- Check checksums for sampled files.
- Write sanitized evidence JSON.

Acceptance criteria:
- Evidence names protected buckets/directories but not secret keys.
- GUI displays last MinIO backup time, size/count, destination mount proof, and sample restore status.

### Goal DR-G5 - Implement Vault And Runtime Secret Backup

Status: ready after DR-G1; can run in parallel with MinIO and DB lanes but integration must be reviewed by the orchestrator.

Objective:
Protect Vault data and recovery material with encrypted, root-restricted backups and sanitized evidence.

Allowed actions:
- Read Vault backup scripts.
- Back up `/opt/vault/data` through a safe Vault/file-storage-aware method.
- Back up `.vault-init` only into encrypted/root-restricted artifacts.
- Write sanitized evidence.

Forbidden actions:
- Printing Vault root token, admin token, unseal key, secret values, or private keys.
- Copying `.vault-init` into an unencrypted world-readable location.
- Overwriting `/opt/vault/data`.
- Reinitializing Vault.

Minimum viable approach:
- Create a root-only encrypted archive under `/mnt/alfares-db-backups/alfares-dr/vault/encrypted`.
- Include `/opt/vault/data` and `/home/ssf/Documents/Github/vault-microservice/.vault-init`.
- Exclude logs unless needed.
- Record SHA256, size, created_at, included path names, and verification result in sanitized evidence.

Preferred if available:
- Use Vault-supported snapshot/export appropriate to the current storage backend.
- Still back up `.vault-init` encrypted and separately.

Validation:
- `tar -tzf` or encrypted archive listing works without extracting to production.
- Restore test extracts to `/mnt/alfares-db-backups/alfares-dr/vault/restore-tests/<timestamp>` only.
- Evidence confirms `.vault-init` was included as encrypted material without exposing content.

Acceptance criteria:
- Vault backup is scheduled.
- Sanitized evidence appears in the Backups GUI.
- Recovery instructions exist and require owner-held decryption/unseal material.

### Goal DR-G6 - Implement Kubernetes Metadata And PVC Coverage

Status: ready after DR-G1 and DR-G2.

Objective:
Back up cluster resources and PVC metadata needed to rebuild the k3s environment.

Allowed actions:
- Export Kubernetes resource YAML.
- Redact or exclude secret values.
- Archive `/etc/rancher/k3s` and selected `/var/lib/rancher/k3s/server` identity/config paths in encrypted/root-only storage.
- Record PVC metadata and local-path locations.

Forbidden actions:
- Applying exported resources back to production.
- Dumping Kubernetes Secret values into plain YAML evidence.
- Stopping k3s.

Suggested exports:

```bash
kubectl get ns -o yaml
kubectl get deploy,statefulset,daemonset,cronjob,job,svc,ingress,cm,pvc,pv,sa,role,rolebinding,clusterrole,clusterrolebinding -A -o yaml
kubectl get externalsecret,secretstore,clustersecretstore -A -o yaml
kubectl get certificate,issuer,clusterissuer -A -o yaml
```

Secret handling:
- For standard Kubernetes Secrets, export names/types/key names only, not `.data`.
- Secret values remain in Vault backup.

Validation:
- `kubectl apply --dry-run=client -f <sanitized-export>` where safe.
- YAML parse succeeds.
- Resource counts are recorded.

Acceptance criteria:
- Rebuild runbook exists.
- GUI shows k3s resource backup age, resource counts, and secret redaction status.

### Goal DR-G7 - Implement Qdrant And Search/Vector Recovery

Status: ready after DR-G1.

Objective:
Protect Qdrant state or document a reliable rebuild path.

Allowed actions:
- Inspect Qdrant API for snapshots if available.
- Back up hostPath `/home/ssf/Documents/Github/docs-rag-microservice/qdrant-storage`.
- Restore to isolated folder/container.

Forbidden actions:
- Overwriting live Qdrant storage.
- Restarting Qdrant without approval.

Acceptance criteria:
- Either a Qdrant snapshot backup exists and verifies, or a rebuild runbook from source documents exists and is visible as coverage.

### Goal DR-G8 - Implement Docker Runtime State Classification And Backup

Status: ready after DR-G0; backup execution after DR-G1.

Objective:
Classify Docker host-level state into critical, rebuildable, or ignored, and back up critical non-Git state.

Inventory commands:

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker inspect <container> --format '{{json .Mounts}}'
docker volume ls
```

Likely critical:
- Vault storage.
- local registry if image provenance cannot rebuild all images immediately.
- Ollama model volume if redownloading is expensive but not user-critical.
- ignored `.env` files and runtime configs, encrypted.

Acceptance criteria:
- Classification report exists.
- Critical items have backups or explicit owner-approved non-backup rationale.
- GUI shows classification and gaps.

### Goal DR-G9 - Backups GUI Control Plane

Status: integration goal after DR-G2 through DR-G8 produce sanitized evidence.

Objective:
Update `backups-microservice` so the owner can log in and see all backup coverage, schedules, evidence, restore verification state, and gaps.

Requirements:
- Show second-disk mount status and destination path.
- Show each source class:
  - PostgreSQL;
  - Redis;
  - MinIO;
  - Vault;
  - Kubernetes resources;
  - PVCs;
  - Qdrant;
  - Docker runtime;
  - runtime config/secrets.
- Show last run status, duration, artifact size, checksum presence, restore verification status, and next scheduled run.
- Show current failures prominently.
- Show "not protected" and "awaiting evidence" states explicitly.
- Do not expose raw paths to backup payloads if they create security risk; show destination label/reference and mount proof.
- Do not expose secret values.
- Restore UI must distinguish:
  - isolated restore verification;
  - production restore request;
  - production restore approval required.
- Production restore buttons must be gated and should be disabled unless all approval fields are present.

Implementation approach:
- Extend dashboard summary to read sanitized evidence JSON files.
- Store backup source coverage model in Backups DB or config.
- Add source types if needed.
- Keep existing protected API behavior.
- Add tests for redaction and GUI rendering.

Validation:

```bash
npm run build
npm test -- --runInBand
node --check web/admin/app.js
git diff --check
curl -sk https://backups.alfares.cz/health
curl -sk https://backups.alfares.cz/info
curl -sk -o /dev/null -w "%{http_code}\n" https://backups.alfares.cz/jobs
```

Authenticated validation:
- Use owner-approved test user/token.
- Confirm dashboard summary contains source coverage without secret values.
- Confirm admin UI renders backup evidence after login.
- Confirm no payload dump, token, password, or key appears in HTML/JS/API output.

### Goal DR-G10 - Scheduling, Retention, And Monitoring

Status: after source backups and GUI evidence exist.

Objective:
Schedule backups safely and make failures visible.

Recommended schedules:
- PostgreSQL/Redis: daily at 02:00, retention 14 daily, 8 weekly if disk allows.
- MinIO: daily incremental/snapshot, retention based on available space; start with 14 daily.
- Vault: daily after secret changes or at least daily, retention 14 daily plus offline copy.
- Kubernetes metadata: daily and after deploys.
- Qdrant: daily or after ingestion.
- Runtime config encrypted backup: daily or after `.env` changes.

Rules:
- Use `flock` to prevent overlapping jobs.
- Write `.partial` artifacts first, then atomic rename.
- Never delete the last successful backup.
- Retention must not remove unverified backups if no verified backup remains.
- Retention below three full backups requires explicit owner approval and audit evidence.

Monitoring:
- Add failure notification through `backups-microservice`.
- Show stale backup warnings:
  - critical source older than RPO;
  - latest run failed;
  - restore verification missing;
  - backup destination not mounted;
  - destination free space below threshold.

### Goal DR-G11 - Full Non-Production Restore Drill

Status: final integration.

Objective:
Prove the backups can restore enough state to rebuild the ecosystem without touching production.

Restore drill scope:
- PostgreSQL dump restores to temporary database/container.
- Redis RDB validates or loads into temporary Redis.
- MinIO sample files restore to isolated directory.
- Vault archive extracts to isolated directory and validates expected structure without exposing secrets.
- Kubernetes YAML parses and dry-runs.
- Qdrant snapshot/file copy validates in isolated folder/container.
- GUI shows verification evidence.

Forbidden:
- Production restore.
- Replacing live PVCs.
- Replacing live Vault.
- Replacing live MinIO path.

Acceptance criteria:
- Restore evidence exists for each source.
- GUI shows restore verification success or explicit blocker.
- Owner receives a concise recovery runbook.

## Parallel Execution Plan

Use subagents only where file ownership and runtime blast radius are independent.

### Workstream A - Disk And Mount Owner

Status: ready now.

Owner role: root disk/mount specialist.

Objective:
Prove and mount the second disk without formatting or data loss.

Allowed files/paths:
- `/mnt/alfares-dr-inspect`
- `/mnt/alfares-db-backups`
- `/mnt/alfares-db-backups/alfares-dr`
- evidence docs under `backups-microservice/docs/orchestrator`

Forbidden:
- formatting, repartitioning, wiping, deleting existing data.

Dependencies:
- owner provides root password interactively.

Expected output:
- mount proof;
- backup root path;
- permission evidence;
- free-space report;
- fstab recommendation, not applied until approved.

### Workstream B - Database Backup Owner

Status: dependency-gated on Workstream A for second-disk path; can inspect scripts now.

Owner role: database-server backup engineer.

Objective:
Make PostgreSQL/Redis backup and isolated restore verification work on second disk.

Allowed repo:
- `/home/ssf/Documents/Github/database-server`

Shared files/contracts:
- sanitized evidence JSON consumed by Backups.

Expected output:
- successful manual backup;
- cron/schedule;
- restore verification;
- sanitized evidence.

### Workstream C - Backups GUI/API Owner

Status: ready for investigation; integration gated on evidence contracts.

Owner role: Backups service engineer.

Objective:
Repair failed backup execution visibility and add GUI coverage for all evidence sources.

Allowed repo:
- `/home/ssf/Documents/Github/backups-microservice`

Forbidden:
- changing database-server scripts;
- changing raw backup payloads;
- exposing secrets.

Expected output:
- dashboard summary support;
- GUI cards/tables;
- failure states;
- tests and deployment evidence.

### Workstream D - MinIO Backup Owner

Status: dependency-gated on Workstream A.

Owner role: object-storage backup engineer.

Objective:
Back up `/srv/speakasap-records` and verify sample restore.

Allowed paths:
- source read-only: `/srv/speakasap-records`
- destination: `/mnt/alfares-db-backups/alfares-dr/minio`
- evidence: `/home/ssf/Documents/Github/shared/runtime-evidence/minio-backups`

Forbidden:
- deleting MinIO objects;
- `rsync --delete` without owner-approved dry run.

Expected output:
- copied/snapshotted object data;
- counts/sizes/checksums;
- sample restore evidence.

### Workstream E - Vault Backup Owner

Status: dependency-gated on Workstream A.

Owner role: secret-recovery engineer.

Objective:
Back up Vault and recovery material safely with encrypted/root-restricted storage.

Allowed paths:
- source: `/opt/vault/data`, `/home/ssf/Documents/Github/vault-microservice/.vault-init`
- destination: `/mnt/alfares-db-backups/alfares-dr/vault`
- evidence: `/home/ssf/Documents/Github/shared/runtime-evidence/vault-backups`

Forbidden:
- printing or committing secret values;
- overwriting live Vault;
- reinitializing Vault.

Expected output:
- encrypted Vault backup;
- isolated archive verification;
- sanitized evidence.

### Workstream F - Kubernetes/PVC/Qdrant Owner

Status: dependency-gated on Workstream A for backup storage; can inspect now.

Owner role: cluster metadata and state backup engineer.

Objective:
Export Kubernetes metadata, classify PVCs, and protect Qdrant state.

Allowed paths:
- `/mnt/alfares-db-backups/alfares-dr/k3s`
- `/mnt/alfares-db-backups/alfares-dr/pvcs`
- `/mnt/alfares-db-backups/alfares-dr/qdrant`
- sanitized evidence under `shared/runtime-evidence`

Forbidden:
- applying exports to production;
- dumping secret values in plain text;
- stopping k3s.

Expected output:
- sanitized cluster export;
- encrypted k3s identity/config archive if root access permits;
- Qdrant backup or rebuild runbook;
- validation evidence.

### Workstream G - Integration And Restore Drill Owner

Status: final integration.

Owner role: orchestrator.

Objective:
Merge evidence contracts, run non-production restore drills, verify GUI, and publish final runbook.

Dependencies:
- A through F complete.

Expected output:
- restore drill evidence;
- GUI screenshots or browser verification;
- final recovery runbook;
- remaining gaps list.

## Merge Order

1. Workstream A establishes backup destination.
2. Workstream B produces database evidence.
3. Workstreams D/E/F produce MinIO, Vault, and k3s/Qdrant evidence.
4. Workstream C consumes evidence contracts and updates GUI/API.
5. Workstream G performs restore drills and final validation.

Do not merge GUI claims before evidence exists. The GUI must show `awaiting_manifest`, `failed`, or `not_configured` honestly.

## Evidence JSON Contract

Each backup lane must produce sanitized evidence with this shape or a documented extension:

```json
{
  "schema_version": 1,
  "source": "database-server",
  "source_category": "postgres_database",
  "status": "success",
  "generated_at": "2026-06-25T00:00:00Z",
  "backup_timestamp": "20260625_020000",
  "host": "alfares",
  "destination": {
    "label": "second-disk",
    "mountpoint": "/mnt/alfares-db-backups",
    "source_device": "/dev/md0",
    "mount_verified": true
  },
  "artifacts": [
    {
      "name": "postgres_all_20260625_020000.sql.gz",
      "kind": "postgres_logical_dump",
      "size_bytes": 123456,
      "sha256": "redacted-example-checksum"
    }
  ],
  "protected_sources": [
    {
      "name": "postgres",
      "kind": "database_cluster",
      "count": 38
    }
  ],
  "restore_verification": {
    "status": "verified",
    "checked_at": "2026-06-25T00:30:00Z",
    "method": "isolated_restore",
    "target": "restore_verify_20260625_020000"
  },
  "secret_policy": "No secret values, passwords, tokens, or dump contents are included in this evidence file."
}
```

Allowed statuses:
- `success`
- `failed`
- `running`
- `awaiting_manifest`
- `not_configured`
- `blocked`
- `stale`

Allowed restore verification statuses:
- `verified`
- `failed`
- `skipped`
- `not_supported_yet`
- `blocked`

## Recovery Runbook Requirements

The final orchestrator must create or update a recovery runbook with:

1. Hardware assumptions.
2. Disk mount procedure.
3. GitHub clone procedure.
4. k3s install/recovery procedure.
5. Vault restore procedure.
6. External Secrets recovery procedure.
7. PostgreSQL restore procedure.
8. Redis restore procedure.
9. MinIO restore procedure.
10. Qdrant restore/rebuild procedure.
11. Docker host-level services recovery procedure.
12. Backups GUI recovery procedure.
13. DNS/TLS/cert-manager recovery notes.
14. Test-user GUI validation steps.
15. Known gaps and manual approvals required.

## GUI Acceptance Criteria

After login, the owner's test user must be able to see:

- Backup destination status:
  - mountpoint;
  - verified second-disk source;
  - free space;
  - last mount check.
- Coverage summary:
  - protected sources;
  - unprotected sources;
  - failed sources;
  - stale sources.
- For each source:
  - source type;
  - owner service;
  - backup schedule;
  - retention;
  - last success;
  - last failure;
  - artifact count/size;
  - checksum presence;
  - restore verification status;
  - next action.
- Restore page:
  - select backup source;
  - view verified restore evidence;
  - trigger isolated restore verification if implemented;
  - production restore is blocked/gated with explicit approval fields.

GUI must not show:
- raw database dump contents;
- raw WAL-G output if it contains paths/secrets;
- Vault tokens;
- unseal keys;
- database passwords;
- MinIO secret keys;
- JWT or API tokens;
- Kubernetes Secret `.data` values.

## Validation Matrix

| Area | Required validation | Pass condition |
|---|---|---|
| Second disk | `findmnt /mnt/alfares-db-backups` | source is second disk/RAID, not `/dev/sda2` or NVMe live data |
| PostgreSQL | `gzip -t`, restore to temp | dump valid and temp restore succeeds |
| Redis | RDB creation and check/temp load | RDB valid |
| MinIO | dry run, copy, sample checksum | sample restored files match |
| Vault | encrypted archive listing/extract to isolated folder | archive valid, no secret output |
| k3s | YAML parse/dry-run, encrypted config archive | export usable, secrets redacted |
| Qdrant | snapshot/copy validation | isolated restore or rebuild path proven |
| GUI API | authenticated dashboard summary | shows evidence, no secrets |
| GUI browser | owner test user login | evidence visible after login |
| Scheduling | crontab/systemd timers/K8s CronJobs | scheduled and non-overlapping |
| Retention | dry-run retention | never deletes last verified backup |

## Stop And Escalate Conditions

Stop immediately and ask the owner if:
- the second disk cannot be proven;
- the candidate disk appears to contain important data and using it would risk overwriting it;
- any backup command would require stopping production services;
- any restore would touch production data;
- any script would delete old backups and no verified backup remains;
- Vault is sealed, unhealthy, or recovery material is missing;
- PostgreSQL dump fails with errors that suggest data corruption;
- MinIO copy reports read errors;
- backup destination has insufficient free space;
- GUI changes require broad auth model changes outside Backups scope.

## Required Session Report Format

Every session must finish with:

```text
Goal:
Branch:
Changed files:
Runtime changes:
Backup destination:
Intent Compliance Report:
Safety gates passed:
Validation:
Restore verification:
GUI verification:
Secrets handling:
Blockers:
Next command:
```

## First Recommended Command Sequence For The New Orchestrator

Start with this exact sequence, then stop and review before any write:

```bash
ssh alfares 'hostname && date && whoami && pwd'
ssh alfares 'cd /home/ssf/Documents/Github/backups-microservice && git status --short --branch && git log -1 --oneline'
ssh alfares 'df -hT && lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,UUID,MOUNTPOINTS,MODEL,SERIAL'
ssh alfares 'cat /proc/mdstat'
ssh alfares 'findmnt -rno TARGET,SOURCE,FSTYPE,OPTIONS | sort'
ssh alfares 'kubectl get pods,pvc,pv -n statex-apps -o wide'
ssh alfares 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"'
ssh alfares 'crontab -l 2>/dev/null || true'
```

Then enter root-capable disk proof mode:

```bash
ssh alfares
sudo -v
sudo lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,UUID,MOUNTPOINTS,MODEL,SERIAL
sudo blkid /dev/sdb* /dev/md0 /dev/md1 2>/dev/null || true
sudo mdadm --detail /dev/md0 /dev/md1 2>/dev/null || true
```

Do not write to the disk until the owner and orchestrator agree that the destination is correct.

## Final Definition Of Done

This project is done only when:

- The backup destination is a proven second physical disk mount.
- All critical source classes have successful backup evidence or explicit owner-approved non-coverage.
- PostgreSQL and Redis restore verification has passed in isolation.
- MinIO sample restore has passed in isolation.
- Vault backup verification has passed without exposing secrets.
- Kubernetes metadata export is restorable/dry-run-valid and secret-safe.
- `backups-microservice` GUI shows all evidence to the owner test user.
- Schedules are installed and visible.
- A final disaster recovery runbook exists.
- The owner has a concise remaining-gaps list.
- No production data was overwritten, restored in place, deleted, or exposed.
