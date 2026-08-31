# System: backups-microservice

```yaml
id: SYSTEM-backups-microservice
status: reviewed
owner: backups-microservice
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: complete
upstream:
  - BUSINESS.md
  - docs/orchestrator/INTENT.md
downstream:
  - docs/06_architecture/INTEGRATION_CONTRACT.md
  - docs/17_governance/PROJECT_INVARIANTS.md
```

## Purpose

`backups-microservice` is the NestJS disaster-recovery control plane for backup orchestration and restore evidence, deployed in `statex-apps` on port 3398 at `backups.alfares.cz`.

## Responsibilities

- Manage backup targets, jobs, runs, restore jobs, verification state, retention guardrails, and operator status.
- Stream PostgreSQL logical archives from `pg_dump` through WAL-G storage commands to MinIO-compatible storage and retrieve approved objects with `wal-g st cat` for `pg_restore`.
- Persist service state in the PostgreSQL `backups` schema (`backup_jobs`, `backup_runs`, and `restore_jobs`) with manual migrations and `synchronize: false`.

## Non-Responsibilities

The service does not own protected business data, PostgreSQL or MinIO runtime, Vault secret values, or Auth identity policy. It must not enable unapproved production restore or agent deletion of backup runs.

## Inputs

Authenticated backup and restore requests, configured schedules, PostgreSQL source connection data, and MinIO-compatible storage configuration. JWT, database, and MinIO credentials are delivered through Vault/External Secrets Operator.

## Outputs

Backup-run and restore-job evidence, restore-verification state, retention outcomes, operator-facing status, and success/failure notifications.

## Dependencies

PostgreSQL supplies the `backups` schema and protected database sources. MinIO-compatible storage receives archive objects. Auth validates management JWTs. Notifications report backup outcomes. Logging, docs-rag, and monitoring are mandatory ecosystem services; health is exposed at `GET /health`.

## Upstream Traceability

`BUSINESS.md`, `docs/00_constitution/CONSTITUTION.md`, `docs/01_vision/VISION.md`, and the detailed safety contract in `docs/orchestrator/INTENT.md` define the service purpose and boundaries.

## Downstream Artifacts

`docs/06_architecture/INTEGRATION_CONTRACT.md`, `docs/17_governance/PROJECT_INVARIANTS.md`, implementation goals, and `docs/orchestrator/VALIDATION_DEBT.md` carry implementation and validation decisions.

## Validation Criteria

`GET /health` returns `200 { status: "ok" }`. Targeted tests validate WAL-G object handling, restore execution, retention, and restore behavior. The IPS profile is validated with `validate_adoption_profile.py --phase planning`.

## Open Questions

The repository documents the need to meet RPO/RTO objectives but contains no owner-approved numeric RPO or RTO target. The project owner must define those targets before they can become an operational acceptance threshold.
