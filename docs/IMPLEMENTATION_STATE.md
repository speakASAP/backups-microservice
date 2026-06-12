# Backups Implementation State

Last updated: 2026-06-12.

## Orchestrator Command

```text
BACKUPS ORCHESTRATOR: continue implementation
```

English continuation command:

```text
Continue implementation of this project.
```

To start the next specific goal:

```text
BACKUPS ORCHESTRATOR: implement goal number 5
```

## Current Status

- Active goal: none
- Active branch: `codex/backups-goal-04-restore-verification`
- Current wave: Wave 2 - Restore verification complete; ready for coverage model review
- Completed goals: 01 Intent Preservation And Roadmap, 02 Operator Dashboard Frontend, 03 Dashboard Summary API, 04 Restore Verification Evidence
- Running goals: none
- Blocked goals: none
- Worker threads: none
- Agent entrypoint: `AGENTS.md`
- Orchestrator prompt: `docs/IMPLEMENTATION_ORCHESTRATOR.md`
- Goal index: `implementation-goals/README.md`
- Intent source: `docs/orchestrator/INTENT.md`
- Intent preservation system: `docs/process/INTENT_PRESERVATION_SYSTEM.md`
- Project invariants: `docs/process/PROJECT_INVARIANTS.md`
- Process gates: `docs/process/OPERATIONAL_GATES.md`
- Branch workflow: `docs/orchestration/branch-workflow.md`
- Deployment status: not requested in this session
- Commit policy: do not commit or push unless the owner explicitly asks

## Goal Roadmap

| Goal | File | Status | Branch | Depends On | Parallel Notes |
|---|---|---|---|---|---|
| 01 | `implementation-goals/GOAL-01-intent-preservation.md` | done | `main` | none | Existing intent docs created |
| 02 | `implementation-goals/GOAL-02-operator-dashboard.md` | done | `main` | 01 | Existing admin frontend prepared |
| 03 | `implementation-goals/GOAL-03-dashboard-summary-api.md` | done | `main` | 01, 02 | Existing summary API prepared |
| 04 | `implementation-goals/GOAL-04-restore-verification.md` | done | `codex/backups-goal-04-restore-verification` | 03 | Validated on remote filesystem |
| 05 | `implementation-goals/GOAL-05-coverage-model.md` | ready | `codex/backups-goal-05-coverage-model` | 03 | Next domain goal after owner review |
| 06 | `implementation-goals/GOAL-06-safety-audit-controls.md` | ready | `codex/backups-goal-06-safety-audit-controls` | 04 | Must preserve restore and retention safety |
| 07 | `implementation-goals/GOAL-07-production-readiness.md` | ready | `codex/backups-goal-07-production-readiness` | 04, 05, 06 | Final smoke/deploy readiness |

## Execution Waves

| Wave | Goals | Mode | Gate Before Next Wave |
|---|---|---|---|
| 1 | 01, 02, 03 | completed baseline | intent docs, dashboard, and summary API exist |
| 2 | 04 Restore Verification | sequential | backup run verification state and UI evidence validated |
| 3 | 05 Coverage Model + 06 Safety Controls | mostly sequential; exploration may be parallel | service coverage, retention, deletion, and restore approval controls validated |
| 4 | 07 Production Readiness | sequential | smoke tests, readiness checks, and deploy evidence documented |

## Worker Threads

None.

When worker sessions are launched, record compressed summaries here:

```text
Worker:
Goal:
Branch/worktree:
Write ownership:
Status:
Summary:
Validation:
Risks:
Changed files:
```

## State Update Rules

At the end of every implementation session, update:

- goal status: `ready`, `active`, `blocked`, `done`, or `superseded`;
- current wave;
- worker summaries;
- branch name;
- validation evidence;
- blockers and owner questions;
- next recommended command.

Also update `STATE.json` and `TASKS.md` when the implementation state changes.

## Validation Evidence Log

Append newest entries at the top.

```text
2026-06-12: Completed BAK-G4 restore verification evidence on `codex/backups-goal-04-restore-verification`. Added backup run verification lifecycle metadata and migration, recorded pending/skipped verification evidence in backup flow, split backup success from verification pending notification events, sanitized public backup run serialization to omit WAL-G output and storage artifact paths, and rendered verification state/reason in dashboard and restore UI. Validation: `npm run build` passed; `npm test -- --runInBand` passed with 2 suites and 5 tests; `node --check web/admin/app.js` passed. Resolved: `.gitignore` now limits backup ignores to artifact-style patterns, so active backup source, entity, test, and intent-plan paths are visible to Git.
2026-06-12: Added project-local Intent Preservation System compliance docs and Goal 04 pre-coding artifacts. New docs: docs/process/INTENT_PRESERVATION_SYSTEM.md, docs/process/PROJECT_INVARIANTS.md, implementation-goals/GOAL-04-restore-verification.execution-plan.md, implementation-goals/GOAL-04-restore-verification.context.md, implementation-goals/GOAL-04-restore-verification.coding-prompt.md, implementation-goals/GOAL-04-restore-verification.validation.md. Documentation-only change. Validation: required IPS chain and operational gate references reviewed locally.
2026-06-12: Added Goalkeeper-style orchestration layer for Backups: AGENTS continuation entrypoint, implementation orchestrator, implementation state, agent orchestration policy, branch workflow, operational gates, implementation-goals index, goal prompts, templates, and next-goal script. Documentation-only change. Validation: `./scripts/next_goal.sh` returns Goal 04 as next action; markdown files reviewed for path consistency.
2026-06-12: Existing Backups intent plan records production `/health` and `/info` as healthy and `/jobs` unauthenticated as `401`. Existing work completed BAK-G1 through BAK-G3: intent preservation docs, dashboard summary API, and frontend management UI. Next domain goal is restore verification evidence.
```

## Required Session Report

Every implementation or merge session must finish with:

```text
Goal:
Branch:
Changed files:
Intent Compliance Report:
Validation:
Blockers:
Next command:
```

## Open Decisions

- Whether restore verification should run against an isolated database, disposable namespace, or service-specific verification hook.
- Whether backup run deletion is fully disabled or owner-gated with explicit approval metadata.
- Which service inventory source becomes canonical for coverage gaps.

## Next Action

Review Goal 04 and then implement Goal 05 coverage model:

```text
BACKUPS ORCHESTRATOR: implement goal number 5
```

Source documents:

```text
implementation-goals/GOAL-05-coverage-model.md
docs/orchestrator/INTENT.md
docs/orchestrator/backup-intent-plan.md
docs/IMPLEMENTATION_ORCHESTRATOR.md
docs/process/INTENT_PRESERVATION_SYSTEM.md
docs/process/PROJECT_INVARIANTS.md
```
