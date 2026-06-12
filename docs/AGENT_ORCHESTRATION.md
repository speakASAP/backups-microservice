# Backups Agent Orchestration

## Master Agent

The master orchestrator owns goal selection, context loading, scope control, validation synthesis, and state updates.

It must not rely on chat history for continuation. It reads `docs/IMPLEMENTATION_STATE.md`, selects the next valid goal, and updates the state before ending a session.

## Worker Roles

Use workers only when their write ownership is disjoint.

| Role | Purpose | Typical Output |
|---|---|---|
| Explorer | Inspect code/docs, identify contracts and risks | Findings, file map, suggested write boundaries |
| Worker | Implement a bounded module or UI slice | Changed files, tests, blockers |
| Validator | Run checks and review acceptance criteria | Validation report, failed criteria, residual risk |
| Merge agent | Integrate isolated branches/worktrees | Merge report, conflicts, validation evidence |

## Coordination Rules

- The master orchestrator assigns one goal at a time unless the state file says parallel work is safe.
- Workers must not modify files outside their assigned write set.
- Workers must not revert unrelated changes.
- Workers must report validation evidence before their work can be accepted.
- The master orchestrator integrates worker output and remains responsible for the final Intent Compliance Report.

## Safety Escalation

Ask the owner before:

- production restore;
- deletion of backup runs or backup artifacts;
- retention below three full backups;
- exposing secret values or backup artifact paths;
- production deployment;
- changing ownership boundaries between Backups, Auth, Vault, PostgreSQL runtime, MinIO runtime, or application services.
