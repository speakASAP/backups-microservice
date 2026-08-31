# Canonical Project Invariants: backups-microservice

```yaml
id: IPS-PROJECT-INVARIANTS-backups-microservice
status: validated
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: validated
upstream:
  - docs/orchestrator/INTENT.md
  - docs/process/PROJECT_INVARIANTS.md
downstream:
  - docs/11_tasks/TASK-001-bootstrap-service.md
  - docs/21_execution_plans/EP-TASK-001-bootstrap-service.md
```

## Purpose

Provide the concise canonical IPS summary of the project’s non-negotiable safety and recoverability rules. `docs/process/PROJECT_INVARIANTS.md` remains the detailed operational invariant matrix.

## Applicability

These invariants apply to documentation, source, tests, UI, deployment scripts, runbooks, and every future target type.

## Invariants

1. Backups owns orchestration and restore evidence, not protected application data.
2. PostgreSQL logical archives use `pg_dump` and WAL-G storage commands with MinIO-compatible storage; approved restores use `wal-g st cat` and `pg_restore` for the exact approved target.
3. Credentials remain in Vault/Kubernetes references and never become UI, source, log, prompt, report, or test data.
4. Production restore is destructive and requires human approval with target, backup run, actor, and reason evidence.
5. Restore capability or verification must be visible before a backup is considered operationally successful.
6. Retention below three full backups is unsafe unless explicitly owner-approved.
7. Agents may create targets/jobs and trigger backups, but may not delete backup runs or restore production without human approval.
8. New MinIO, Kubernetes, secret, or PVC target types must not break PostgreSQL backup behavior.
9. Every implementation goal records boundary-preserving validation evidence.

## Exceptions

No standing exceptions are approved. The project owner must approve and record any exception in the affected execution plan and validation evidence.

## Review Cadence

Review before coding goals, after restore, retention, or security changes, and before production deployment. Consult the detailed process document at `docs/process/PROJECT_INVARIANTS.md`.
