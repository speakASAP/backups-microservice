# Backups Branch Workflow

## Default Branches

Use the `codex/` prefix for goal branches unless the owner requests another name.

```text
codex/backups-goal-04-restore-verification
codex/backups-goal-05-coverage-model
codex/backups-goal-06-safety-audit-controls
codex/backups-goal-07-production-readiness
codex/backups-merge-goals
```

## Sequential Work

Sequential goals may run on one branch and be merged after validation.

Before editing:

```bash
git status --short --branch
```

After validation, update:

- `docs/IMPLEMENTATION_STATE.md`
- `STATE.json`
- `TASKS.md`
- goal execution/validation artifacts

Commit only when the owner asks.

## Parallel Work

Parallel work requires separate branches or worktrees and disjoint write ownership.

Do not run parallel goals that both change:

- shared entities or migrations;
- shared DTOs;
- `src/app.module.ts`;
- admin frontend shared state;
- deployment scripts;
- orchestration state files.

## Merge Rules

Merge one branch at a time.

Resolve conflicts by preserving:

- disaster-recovery intent;
- restore safety;
- secret handling;
- retention guardrails;
- validation evidence.

Run all validation commands required by the merged goals before updating state.
