# Backups Intent Preservation System

```yaml
id: BAK-IPS
status: reviewed
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - docs/orchestrator/INTENT.md
  - docs/orchestrator/backup-intent-plan.md
  - /Users/Sergej.Stasok/Documents/Gitlab/intent-preservation-system/README.md
  - /Users/Sergej.Stasok/Documents/Gitlab/intent-preservation-system/23_documentation_contracts/DOCUMENTATION_COMPLETENESS_STANDARD.md
  - /Users/Sergej.Stasok/Documents/Gitlab/intent-preservation-system/23_documentation_contracts/OPERATIONAL_GATE_STANDARD.md
downstream:
  - docs/process/OPERATIONAL_GATES.md
  - docs/process/PROJECT_INVARIANTS.md
  - docs/IMPLEMENTATION_ORCHESTRATOR.md
  - implementation-goals/README.md
related_adrs: []
```

## Purpose

This document adapts the company Intent Preservation System to the Backups microservice. It defines how original disaster-recovery intent is preserved from documentation through implementation, validation, and owner review.

Backups does not use the full numbered IPS folder tree. Instead, it maps the required IPS chain onto the existing repository structure and requires the same evidence before code is changed.

## Preserved Intent Chain

Every implementation task must preserve this chain:

```text
Original Intent
  -> Goal Impact
  -> System Boundaries
  -> Feature or Goal
  -> Execution Plan
  -> Context Package
  -> Coding Prompt
  -> Code
  -> Validation Report
  -> State Update
```

## Local IPS Mapping

| IPS layer | Backups source of truth |
|---|---|
| Original intent | `docs/orchestrator/INTENT.md` |
| Intent expansion and roadmap | `docs/orchestrator/backup-intent-plan.md` |
| Project invariants | `docs/process/PROJECT_INVARIANTS.md` |
| Operational gates | `docs/process/OPERATIONAL_GATES.md` |
| Orchestrator rules | `AGENTS.md`, `docs/IMPLEMENTATION_ORCHESTRATOR.md` |
| State and continuation | `docs/IMPLEMENTATION_STATE.md`, `STATE.json`, `TASKS.md` |
| Goal impact records | `implementation-goals/GOAL-XX-*.md` |
| Execution plans | `implementation-goals/GOAL-XX-*.execution-plan.md` |
| Context packages | `implementation-goals/GOAL-XX-*.context.md` |
| Coding prompts | `implementation-goals/GOAL-XX-*.coding-prompt.md` |
| Validation reports | `implementation-goals/GOAL-XX-*.validation.md` or `reports/validation/` |
| Branch/worktree control | `docs/orchestration/branch-workflow.md` |

## Required Stages Before Coding

### Stage 0 - Intake

Required checks:

- Read `AGENTS.md`, `TASKS.md`, `STATE.json`, `docs/IMPLEMENTATION_STATE.md`, `docs/orchestrator/INTENT.md`, and `docs/orchestrator/backup-intent-plan.md`.
- Query docs RAG when available before reading source code.
- Run `git status --short --branch`.
- Identify owner instructions, branch, uncommitted changes, and the selected goal.

Exit evidence:

- selected goal;
- current branch;
- dirty worktree notes;
- blocker or next action.

### Stage 1 - Intent And Goal Traceability

Required checks:

- The selected goal exists in `implementation-goals/`.
- The goal links back to `docs/orchestrator/INTENT.md` and `docs/orchestrator/backup-intent-plan.md`.
- Acceptance criteria, non-goals, files to inspect, validation plan, and safety notes are present.
- The goal does not contradict restore safety, retention, secret handling, or ownership boundaries.

Exit evidence:

- goal ID and source file;
- traceability statement;
- listed invariants that apply.

### Stage 2 - Execution Planning

Required checks:

- Create or update `implementation-goals/GOAL-XX-*.execution-plan.md`.
- Use `implementation-goals/templates/EXECUTION_PLAN.md`.
- Include upstream traceability, project invariants, sensitive-data handling, contract/schema impact, replay/idempotency impact, file scope, validation plan, rollback plan, and agent handoff prompt.
- Mark unknown owner-only decisions with `[MISSING: ...]` or `[UNKNOWN: ...]`.

Exit evidence:

- execution plan path;
- allowed file scope;
- forbidden file scope;
- gate commands.

### Stage 3 - Context Package

Required checks:

- Create or update `implementation-goals/GOAL-XX-*.context.md` when the coding task spans more than one file or may be delegated.
- Include required reading, current behavior, target behavior, relevant API/schema/UI contracts, constraints, and validation expectations.
- Do not include secrets, raw production data, or sensitive artifact paths.

Exit evidence:

- context package path;
- sensitive-data classification;
- source documents used.

### Stage 4 - Coding Prompt

Required checks:

- Create or update `implementation-goals/GOAL-XX-*.coding-prompt.md` before implementation or delegation.
- Include assignment, scope, non-goals, safety requirements, implementation notes, validation commands, and required report shape.
- Make forbidden changes explicit.

Exit evidence:

- coding prompt path;
- explicit allowed and forbidden changes.

### Stage 5 - Pre-Coding Gate

Required checks:

- Run or manually satisfy the documentation gate in `docs/process/OPERATIONAL_GATES.md`.
- Verify `docs/process/PROJECT_INVARIANTS.md` applies to the selected goal.
- Verify no secret values or production samples were added to docs or prompts.
- Verify owner-only decisions are not invented.

Exit evidence:

- gate command or manual checklist used;
- pass/fail status;
- blocked items.

### Stage 6 - Coding

Required checks:

- Modify only files allowed by the execution plan.
- Preserve unrelated user changes.
- Do not deploy, commit, or push unless the owner explicitly asks.
- Record deviations immediately if scope changes.

Exit evidence:

- changed files;
- deviations from execution plan;
- no forbidden files modified.

### Stage 7 - Validation

Required checks:

- Run the narrowest relevant commands from `docs/process/OPERATIONAL_GATES.md`.
- Run build/tests for code changes where dependencies are available.
- Run frontend syntax checks for `web/admin/app.js` changes.
- Manually verify safety invariants where automation is unavailable.
- Create or update a validation report before marking a goal complete.

Exit evidence:

- command results;
- safety evidence;
- failed criteria and follow-up;
- recommendation.

### Stage 8 - State Update And Review

Required checks:

- Update `docs/IMPLEMENTATION_STATE.md`, `STATE.json`, and `TASKS.md`.
- Update the selected goal status and evidence.
- Produce the Intent Compliance Report.
- Ask for owner approval before deployment, destructive restore, backup-run deletion, retention below three full backups, commit, or push.

Exit evidence:

- state files updated;
- next command;
- owner approvals still required.

## Completion Standard

A goal is not complete until all applicable stages are complete or explicitly recorded as blocked. Missing information must remain visible with `[MISSING: ...]` or `[UNKNOWN: ...]`; it must not be hidden behind generic prose.

## Forbidden Shortcuts

- Do not convert vague owner intent directly into code.
- Do not skip execution plans for coding work.
- Do not skip validation because the change is small.
- Do not invent business goals, approvals, or service ownership.
- Do not place secrets, tokens, raw production data, or sensitive backup artifact paths in prompts, reports, examples, logs, UI, or source.
- Do not weaken a gate to make a goal pass.
