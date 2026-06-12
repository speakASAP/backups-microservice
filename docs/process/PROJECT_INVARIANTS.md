# Backups Project Invariants

```yaml
id: BAK-PROJECT-INVARIANTS
status: reviewed
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - docs/orchestrator/INTENT.md
  - docs/orchestrator/backup-intent-plan.md
  - docs/process/INTENT_PRESERVATION_SYSTEM.md
downstream:
  - docs/process/OPERATIONAL_GATES.md
  - implementation-goals/README.md
related_adrs: []
```

## Purpose

These invariants are the non-negotiable checks every Backups implementation must preserve. They turn the original disaster-recovery intent into concrete pre-coding, validation, and review criteria.

## Applicability

These invariants apply to all documentation, prompts, source changes, tests, UI changes, deployment scripts, and operational runbooks in this repository.

## Invariants

| ID | Level | Source | Rule | Forbidden outcome | Validation method | Gate |
|---|---|---|---|---|---|---|
| BAK-INV-001 | intent | `docs/orchestrator/INTENT.md` | Backups owns backup orchestration, restore evidence, retention guardrails, and operator status. | Backups becomes owner of application-domain data or service business logic. | Review goal scope, entity changes, DTOs, UI copy, and API contracts. | pre-coding, validation |
| BAK-INV-002 | safety | `docs/orchestrator/INTENT.md` | Production restore is destructive and requires explicit human approval with target, backup run, actor, and reason evidence. | Production restore can be triggered accidentally, anonymously, or without recorded reason. | Inspect restore DTOs, controllers, service flow, UI actions, and tests. | pre-coding, validation, deployment |
| BAK-INV-003 | security | `docs/orchestrator/INTENT.md` | Secrets stay in Vault/Kubernetes references and must never appear in UI, logs, prompts, reports, tests, examples, or source. | Secret values, tokens, passwords, private keys, or raw credentials are committed or shown to agents/users. | Search changed files for secret-like values; inspect API/UI outputs and docs examples. | pre-coding, validation, deployment |
| BAK-INV-004 | recoverability | `docs/orchestrator/INTENT.md` | Backups are not operationally successful unless restore capability or verification status is visible. | A backup run is presented as fully successful while restore verification is absent or unknown. | Inspect backup run status model, dashboard summary, UI run display, and validation reports. | pre-coding, validation |
| BAK-INV-005 | retention | `docs/orchestrator/INTENT.md` | Retention below three full backups requires explicit owner approval metadata. | A job or policy silently allows fewer than three full backups. | Inspect job DTO validation, service policy, UI warnings, and audit evidence. | pre-coding, validation |
| BAK-INV-006 | audit | `docs/orchestrator/backup-intent-plan.md` | Destructive or risk-changing operations must record actor, target, action, and reason. | Backup deletion, restore, or retention weakening leaves no audit trail. | Inspect controllers, services, notification/logging hooks, and validation report. | pre-coding, validation |
| BAK-INV-007 | extensibility | `docs/orchestrator/backup-intent-plan.md` | New source types must extend the target model without breaking PostgreSQL backup behavior. | MinIO, K8s, secret, or PVC support changes PostgreSQL contracts incompatibly. | Inspect migrations, entities, DTOs, and backward-compatibility tests. | pre-coding, validation |
| BAK-INV-008 | auth | `CLAUDE.md` and `docs/orchestrator/backup-intent-plan.md` | Management operations remain protected by Auth-owned identity and RBAC boundaries. | Backup management endpoints become public or bypass Auth without documented exception. | HTTP unauthenticated checks and controller/guard inspection. | validation, deployment |
| BAK-INV-009 | operations | `docs/process/INTENT_PRESERVATION_SYSTEM.md` | Coding requires execution plan, context, prompt, gate evidence, validation, and state update. | Agent edits source directly from vague intent or without evidence chain. | Check goal artifacts and `docs/IMPLEMENTATION_STATE.md`. | pre-coding |

## Exceptions

No standing exceptions are approved. Exceptions must be owner-approved and recorded in the selected execution plan and validation report.

## Review Cadence

Review these invariants before every coding goal, after any restore/retention/security architecture change, and before production deployment.
