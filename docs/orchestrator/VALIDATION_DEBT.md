# Validation Debt Ledger

## Purpose

Record known validation failures that are not caused by the current task, so agents can separate existing repo debt from real regressions.

## Rules

- This ledger does not excuse current-task failures.
- Every entry needs an owner, scope, and unblock condition.
- Do not include secrets, tokens, raw production data, customer identifiers, or private evidence.
- If a failure starts affecting the current task, promote it from debt to blocker.

## Entries

| ID | Date | Command | Failure Summary | Scope | Owner | Blocks Current Task? | Unblock Condition | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VD-002 | 2026-08-30 | `./node_modules/.bin/eslint <changed files>` | ESLint 8.57.1 found no repository configuration file. | repo-wide tooling | backups-microservice | no | Add or restore an approved ESLint configuration before treating lint as an executable gate. | BAK-G16 session output; build/tests pass. |

## BAK-G16 HIGH-review Follow-up (2026-08-31)

- VD-002 remains the only validation debt; no ESLint configuration was added as
  part of this bounded safety repair.
- No new validation debt was created. Focused/full tests, build/typecheck,
  syntax/JSON/diff gates, validation image, synthetic WAL-G dump/restore, and
  isolated database concurrency checks all passed after harness fixes were
  rerun.

## Current-Task Decision Checklist

- Does the failing command touch files changed by this task?
- Does the failure mention this task ID, goal ID, or changed module?
- Is the failure already listed above with `Blocks Current Task? = no`?
- Did the failure exist before this task started?
- Is the validation command required by the current task acceptance criteria?

## Update Format

```text
Validation debt check:
- Command:
- Result:
- Matched ledger entry:
- Current-task impact:
- Next action:
```

Use the `## Entries` table for each classified out-of-scope failure: date, command, sanitized summary, scope, owner, current-task impact, unblock condition, and safe evidence location. Keep entries current whenever failures are classified as out of scope.
