# Alfares Critical Service Backups

## Purpose

This runbook documents the non-database disaster-recovery backup for Alfares critical services that are not recoverable from Git alone.

Database logical backups are handled by a separate database backup lane. Do not treat this runbook as the database restore procedure.

## Intent Preservation Chain

- Vision: Preserve the Alfares ecosystem from irreversible loss if the primary disk fails.
- Goal Impact: Keep Vault, Kubernetes identity, Kubernetes manifests, and recovery credentials restorable without exposing secret values in UI, logs, or Git.
- System: Alfares host-level `systemd` backup runner writing encrypted artifacts to the second HDD.
- Feature: Encrypted critical-service backups with root-only passphrase copies on all three local disks.
- Task: Back up Vault and Kubernetes critical state; document exact key locations for future agents.
- Execution Plan: Use `/usr/local/sbin/alfares-critical-backup.sh` via `alfares-critical-backup.timer`; store encrypted artifacts under `/srv/critical-backups/alfares-critical`.
- Coding Prompt: [MISSING: no code-generation prompt was created for this emergency root-host operation]
- Code: `/usr/local/sbin/alfares-critical-backup.sh`, `/etc/systemd/system/alfares-critical-backup.service`, `/etc/systemd/system/alfares-critical-backup.timer`.
- Validation: Latest successful run and checksum/decrypt smoke evidence are stored on the host under `/srv/critical-backups/alfares-critical/latest-status.json` and the latest run directory.

## Backup Runner

- Service: `alfares-critical-backup.service`
- Timer: `alfares-critical-backup.timer`
- Schedule: daily around `02:17` server time, with `RandomizedDelaySec=10m`
- Script: `/usr/local/sbin/alfares-critical-backup.sh`
- Destination mount: `/srv/critical-backups`
- Destination device: `/dev/md0` mounted as ext4
- Latest backup symlink: `/srv/critical-backups/alfares-critical/latest`
- Latest metadata: `/srv/critical-backups/alfares-critical/latest-status.json`

## Encrypted Artifacts

Each run directory contains:

- `host-critical.tar.gz.enc`: encrypted host-critical Vault/K3s archive
- `kubernetes-api-export.yaml.enc`: encrypted Kubernetes API export
- `SHA256SUMS`: checksums for encrypted artifacts and plaintext inventories
- Plaintext inventories with no secret values: disks, filesystems, mounts, storage inventory, ExternalSecrets inventory, and Kubernetes secret names/types only


## Runbook Locations

This runbook is intentionally stored in Git under:

- `/home/ssf/Documents/Github/backups-microservice/docs/operations/critical-service-dr-runbook.md`

Root-owned copies are stored on all three local disks:

- `/srv/critical-backups/alfares-critical/RECOVERY.md`
- `/etc/alfares-critical-backup/RECOVERY.md`
- `/mnt/docker-data/alfares-critical-backup-key/RECOVERY.md`

Short key-location pointer files are stored at:

- `/srv/critical-backups/alfares-critical/KEY_LOCATIONS.txt`
- `/etc/alfares-critical-backup/KEY_LOCATIONS.txt`
- `/mnt/docker-data/alfares-critical-backup-key/KEY_LOCATIONS.txt`

## Passphrase File Locations

The same OpenSSL passphrase file is intentionally stored on all three local disks so a future recovery agent can decrypt backups even if one disk fails. The file content must not be printed in chat, committed to Git, added to UI payloads, or copied to non-root-readable locations.

All passphrase files must be owned by `root:root` with mode `0600`.

| Disk / mount | Device evidence | Passphrase file |
| --- | --- | --- |
| Root HDD | `/` on `/dev/sda2` | `/etc/alfares-critical-backup/critical-backups.pass` |
| Backup HDD / second disk | `/srv/critical-backups` on `/dev/md0` | `/srv/critical-backups/.backup-secret/critical-backups.pass` |
| NVMe SSD | `/mnt/docker-data` on `/dev/nvme0n1p1` | `/mnt/docker-data/alfares-critical-backup-key/critical-backups.pass` |

The backup runner uses `/srv/critical-backups/.backup-secret/critical-backups.pass` by default.

## Restore Smoke Commands

Run as root on `alfares`.

List files inside the encrypted host archive without extracting:

```bash
RUN_DIR=$(readlink -f /srv/critical-backups/alfares-critical/latest)
openssl enc -d -aes-256-cbc -pbkdf2 \
  -pass file:/srv/critical-backups/.backup-secret/critical-backups.pass \
  -in "$RUN_DIR/host-critical.tar.gz.enc" 2>/dev/null | tar -tzf - | sed -n '1,80p'
```

Verify checksums:

```bash
RUN_DIR=$(readlink -f /srv/critical-backups/alfares-critical/latest)
cd "$RUN_DIR"
sha256sum -c SHA256SUMS
```

If `/srv/critical-backups/.backup-secret/critical-backups.pass` is unavailable, use one of the other documented passphrase copies with the same `openssl -pass file:<path>` argument.

## Security Rules

- Do not print the passphrase file content.
- Do not commit any `*.pass` file.
- Do not copy the passphrase into `/home/ssf/Documents/Github` or any repository.
- Keep passphrase copies root-only (`0600`).
- Keep recovery docs readable, but never include the passphrase value.
- The backup device `/dev/md0` is a degraded RAID member backed by the second HDD; monitor `/proc/mdstat`.

## Current Gaps

- MinIO/SpeakASAP object data and large Prometheus/Grafana PVC content are not fully copied by the small critical-service runner. They need a separate large-data backup or off-server mirror lane.
- Database logical backup is out of scope here and remains owned by the database backup agent.
