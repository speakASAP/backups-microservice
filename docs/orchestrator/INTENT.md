# Backups Intent Preservation

## Original Intent

Backups is the ecosystem durability service. It must answer: what data is protected, which service or database owns it, how often it is backed up, where the backup is stored, how long it is retained, whether restore has been verified, and what operator action is required before data is at risk.

## Intent Preservation Rules

1. Backups owns backup orchestration and restore evidence, not the business data inside protected services.
2. PostgreSQL backups use WAL-G logical `pgbackup` mode and store artifacts in MinIO-compatible object storage.
3. Backup secrets are never UI or source-code data. Credentials remain in Vault and Kubernetes secrets.
4. Restore is destructive. Production restore requires explicit human approval and must clearly name the target and backup run.
5. A backup that cannot be restored or verified is not considered successful operational protection.
6. Retention below three full backups is unsafe unless the owner explicitly approves it.
7. Agents may create targets, create/modify jobs, and trigger backups, but must not delete backup runs or restore production targets without human approval.
8. Future target types, including MinIO buckets, Kubernetes resources, secrets, and PVCs, must extend the target model without breaking PostgreSQL backup behavior.
9. Every implementation goal must preserve these boundaries and record evidence.

## Drift Checks

Before any change, ask:

- Does this improve ecosystem recoverability and operator visibility?
- Does it expose a secret, token, password, or backup artifact path that should remain internal?
- Does it make restore too easy to trigger accidentally?
- Does it weaken retention, verification, or audit evidence?
- Does it couple backups to one application instead of modeling service-owned sources generically?
- Does the UI show enough evidence for operators to know which services are protected and which are not?
