# Business: backups-microservice

```yaml
id: BUSINESS-backups-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: complete
upstream:
  - docs/00_constitution/CONSTITUTION.md
  - docs/01_vision/VISION.md
downstream:
  - SYSTEM.md
  - docs/22_goal_impact/GOAL-IMPACT-TASK-001.md
```

## Problem

The ecosystem needs an accountable disaster-recovery control plane that shows protected data, its owner and schedule, storage location, retention, restore-verification state, and the operator action required before data is at risk.

## Target Users and Stakeholders

Operators use backup and restore evidence to assess recoverability. The project owner approves policy changes, destructive production restores, and retention below three full backups. Protected service owners retain ownership of their application data.

## Value Proposition

Backups centralizes backup targets, jobs, run evidence, restore requests, restore verification, retention guardrails, and operator status without taking ownership of protected application-domain data.

## Goals

- Protect ecosystem data against loss through scheduled PostgreSQL logical archives and MinIO-compatible object storage.
- Make restore capability and verification visible; an unverified backup is not successful operational protection.
- Preserve safe, auditable operator control over retention and destructive restore actions.

## Non-Goals

- Owning application-domain data, PostgreSQL runtime, MinIO runtime, Vault secrets, or Auth identity policy.
- Allowing agents to delete backup runs or restore production targets without explicit human approval.
- Breaking PostgreSQL backup behavior when extending future MinIO bucket, Kubernetes resource, secret, or PVC targets.

## Success Metrics

Operational success is evidenced by a protected target having backup-run evidence and visible restore capability or verification status. Specific numeric RPO and RTO targets are not documented in this repository and require project-owner definition.

## Business Constraints

- Secrets remain in Vault and Kubernetes secret references; they must not appear in source, UI, logs, prompts, or reports.
- Production restore is destructive and requires explicit human approval identifying the target, backup run, actor, and reason.
- Retention below three full backups is unsafe unless explicitly owner-approved.
- The safety rules in `docs/orchestrator/INTENT.md` govern all changes.

## Approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: backups-microservice-onboarding-approved
