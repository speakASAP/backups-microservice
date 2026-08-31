# Vision: backups-microservice

```yaml
id: VISION-backups-microservice
status: approved
owner: project owner
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: complete
upstream:
  - docs/00_constitution/CONSTITUTION.md
downstream:
  - BUSINESS.md
  - SYSTEM.md
```

## One-Sentence Vision

Give Alfares operators trustworthy, safe evidence that protected ecosystem data can be recovered.

## Problem Statement

Data protection is incomplete without a clear view of source ownership, backup cadence, storage, retention, restore verification, and required operator action.

## Target Users

Disaster-recovery operators, protected-service owners, and the project owner who approves destructive and policy-changing actions.

## Core User Need

Operators need to determine whether a protected target has a safe, verifiable recovery path without exposing credentials or accidentally initiating destructive restore.

## Key Outcomes

Visible backup-run and restore evidence, safe retention control, and approved PostgreSQL recovery through MinIO-compatible object storage.

## Non-Goals

Owning domain data or infrastructure runtimes, exposing secrets, or allowing agents to delete backup runs or restore production independently.

## Success Criteria

Each protected target can be represented with backup evidence and visible restore capability or verification state. Numeric RPO/RTO targets remain an owner decision not documented here.

## Approval

Status: approved
Approved by: project owner
Approval evidence: owner-confirmation: backups-microservice-onboarding-approved
