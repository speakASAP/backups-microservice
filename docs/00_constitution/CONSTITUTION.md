# Project Constitution: backups-microservice

```yaml
id: CONSTITUTION-backups-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: complete
upstream:
  - docs/orchestrator/INTENT.md
downstream:
  - BUSINESS.md
  - docs/01_vision/VISION.md
```

## Purpose

Establish the durable operating boundaries for the ecosystem backup and restore-evidence control plane.

## Constitutional Principles

- Backups orchestrates protection and evidence; protected services retain ownership of their business data.
- Secrets remain in Vault and Kubernetes references, never in source, UI, logs, prompts, or reports.
- Production restore is destructive and requires explicit human approval naming the target, backup run, actor, and reason.
- A backup without visible restore capability or verification is not successful operational protection.
- Retention below three full backups requires explicit owner approval.

## Amendment Process

The project owner approves amendments after they are reconciled with `docs/orchestrator/INTENT.md`, canonical invariants, and implementation validation evidence.

## Approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: backups-microservice-onboarding-approved
