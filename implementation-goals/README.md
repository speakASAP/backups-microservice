# Backups Implementation Goals

This directory contains executable goal prompts for Backups orchestrator sessions.

Use the master command from `../docs/IMPLEMENTATION_ORCHESTRATOR.md`:

```text
BACKUPS ORCHESTRATOR: continue implementation
```

To print the current resume checkpoint from the shell:

```bash
./next_goal.sh
```

## Goals

1. `GOAL-01-intent-preservation.md` - intent preservation docs and backup roadmap.
2. `GOAL-02-operator-dashboard.md` - operator dashboard for targets, jobs, runs, restore history, and guardrails.
3. `GOAL-03-dashboard-summary-api.md` - read-only operational dashboard summary API.
4. `GOAL-04-restore-verification.md` - restore verification state, evidence, notifications, and UI.
5. `GOAL-05-coverage-model.md` - ecosystem coverage model for databases, object storage, Kubernetes resources, secrets, PVCs, and service ownership.
6. `GOAL-06-safety-audit-controls.md` - retention, backup-run deletion, restore approval, and audit hardening.
7. `GOAL-07-production-readiness.md` - smoke tests, readiness checks, deploy evidence, and operational runbook.
8. `GOAL-08-postgres-schema-migrations.md` - PostgreSQL schema namespace and migration tooling.
9. `GOAL-09-nightly-pgbackup-minio.md` - default nightly PostgreSQL logical backup job to MinIO.
10. `GOAL-10-configurable-schedules.md` - configurable hourly/daily/weekly/custom cron schedule policies.
11. `GOAL-11-restore-from-minio-verify.md` - restore from MinIO/WAL-G and update verification evidence.
12. `GOAL-12-notifications-integration.md` - success/failure notifications for backup, restore, verification, and retention events.
13. `GOAL-13-logging-integration.md` - structured, redacted operational logging for backup control-plane lifecycle events.
14. `GOAL-14-durability-evidence-ui.md` - sanitized database and Vault durability evidence in the dashboard.
15. `GOAL-15-disaster-recovery-catalog-ui.md` - sanitized centralized disaster-recovery catalog in the dashboard.

## Parallelization

Safe default:

```text
01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15
```

Goal 05 exploration can begin while Goal 04 implementation is active only if it is documentation-only and does not alter shared entities, migrations, DTOs, or UI contracts. Goal 06 depends on the restore verification model from Goal 04.

## Required Workflow For Every Goal

Every goal session must:

1. Read the required documents listed in `../AGENTS.md`.
2. Run `git status --short --branch` before editing.
3. Create or update a local execution plan before coding, using `templates/EXECUTION_PLAN.md`.
4. Create or update context package, coding prompt, and validation report shell before source edits.
5. Check applicable invariants from `../docs/process/PROJECT_INVARIANTS.md`.
6. Keep implementation within the selected goal scope.
7. Split work into workers only when ownership is disjoint.
8. Run the narrowest relevant validation and gate commands.
9. Produce an `Intent Compliance Report`.
10. Update `../docs/IMPLEMENTATION_STATE.md`, `../STATE.json`, and `../TASKS.md`.
11. Do not deploy, commit, or push unless the owner explicitly asks.

## Local Process Templates

Use these templates for goal execution artifacts:

- `templates/EXECUTION_PLAN.md`
- `templates/CONTEXT_PACKAGE.md`
- `templates/CODING_PROMPT.md`
- `templates/VALIDATION_REPORT.md`

Goal-specific artifacts should follow this naming:

```text
GOAL-XX-name.execution-plan.md
GOAL-XX-name.context.md
GOAL-XX-name.coding-prompt.md
GOAL-XX-name.validation.md
```

## Required Final Report Shape

Every goal, merge, or validation session must end with:

```markdown
## Intent Compliance Report

### Goal
...

### Implemented
...

### Not Implemented
...

### Boundary Check
...

### Subagents Used
...

### Validation Evidence
...

### Risks
...

### Files Changed
...

### Next Action
...
```

## Global Non-Goals

Do not implement:

```text
secret exposure in UI, logs, prompts, reports, tests, or source
production restore without explicit human approval
backup run deletion without owner approval and audit reason
retention below three full backups without explicit approval metadata
application-domain data ownership inside Backups
production deployment without owner approval
unrelated SaaS, billing, chat, or dashboard-only features
```
