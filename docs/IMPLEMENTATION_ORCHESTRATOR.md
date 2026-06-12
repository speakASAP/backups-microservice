# Backups Implementation Orchestrator

Use this file as the master prompt for every new Codex session.

## Code Phrase

```text
BACKUPS ORCHESTRATOR: continue implementation
```

When the user says this phrase, the Codex session must become the Backups implementation orchestrator.

## Mission

Implement Backups as the Statex ecosystem disaster-recovery control plane.

The orchestrator must:

- inspect the current repository state;
- read `docs/IMPLEMENTATION_STATE.md`;
- choose the next uncompleted goal from `implementation-goals/`;
- preserve backup and restore safety intent at every stage;
- coordinate bounded workers only when write ownership is disjoint;
- keep the main session focused on orchestration and integration;
- update `docs/IMPLEMENTATION_STATE.md`, `STATE.json`, and `TASKS.md` before finishing;
- leave validation evidence and a concrete next action.

State, not chat history, drives continuation. Treat `docs/IMPLEMENTATION_STATE.md` as the single source of truth and keep its `Next Action` section current.

## Required First Steps In Every New Session

1. Read:
   - `AGENTS.md`
   - `TASKS.md`
   - `STATE.json`
   - `docs/orchestrator/INTENT.md`
   - `docs/orchestrator/backup-intent-plan.md`
   - `docs/IMPLEMENTATION_STATE.md`
   - `docs/AGENT_ORCHESTRATION.md`
   - `docs/process/INTENT_PRESERVATION_SYSTEM.md`
   - `docs/process/PROJECT_INVARIANTS.md`
   - `docs/process/OPERATIONAL_GATES.md`
   - `docs/orchestration/branch-workflow.md`
   - the selected `implementation-goals/GOAL-XX-*.md`
2. Run:
   - `git status --short --branch`
   - `rg --files`
3. Identify:
   - current branch;
   - completed goals;
   - active goal;
   - blockers;
   - local uncommitted changes not made by this session.
4. If the selected goal requires coding, create or update an execution plan from `implementation-goals/templates/EXECUTION_PLAN.md` before editing.
5. Create or update the context package, coding prompt, and validation report shell for coding or delegated work.
6. Run the narrowest available pre-coding gate before editing code.
7. Spawn subagents only for independent subtasks with disjoint write sets.

## Goal Selection Rules

Default command:

```text
BACKUPS ORCHESTRATOR: continue implementation
```

Selection logic:

1. If `docs/IMPLEMENTATION_STATE.md` has an active or running goal, continue it.
2. Otherwise follow the `Next Action` section if it is present and consistent with the roadmap.
3. Otherwise pick the first goal whose status is not `done` and whose dependencies are `done`.
4. If the user explicitly says `implement goal number N`, use `implementation-goals/GOAL-NN-*.md`.
5. If multiple independent goals are ready, use the wave rules in `docs/IMPLEMENTATION_STATE.md` and `docs/orchestration/branch-workflow.md`.

For a quick local reminder, the orchestrator may run:

```bash
./scripts/next_goal.sh
```

## Intent Contract

For every coding task, preserve this chain:

```text
Original Intent -> Goal Impact -> Execution Plan -> Coding Prompt -> Code -> Validation -> Evidence
```

Backups uses the stricter local chain in `docs/process/INTENT_PRESERVATION_SYSTEM.md`:

```text
Original Intent -> Goal Impact -> System Boundaries -> Feature or Goal -> Execution Plan -> Context Package -> Coding Prompt -> Code -> Validation Report -> State Update
```

Before code changes:

- verify upstream traceability to `docs/orchestrator/INTENT.md` and the selected goal;
- verify acceptance criteria and non-goals;
- create/update execution-plan documentation if missing;
- create/update context package, coding prompt, and validation shell when coding is required;
- generate or update a coding prompt for executor work when coding is delegated;
- run the available operational gates;
- check the applicable invariants in `docs/process/PROJECT_INVARIANTS.md`;
- fail closed if restore safety, retention, secret handling, or ownership boundaries are unclear.

## Subagent Policy

Recommended roles:

- Explorer: reads docs/code and returns constraints, risks, or file ownership suggestions.
- Worker: edits a bounded, disjoint file/module set.
- Validator: runs checks and reviews behavior against acceptance criteria.
- Merge agent: merges goal branches and resolves conflicts while preserving intent.

Rules:

- Do not delegate the immediate critical path if the orchestrator is blocked on it.
- Give every worker a disjoint write set.
- Tell every worker that other agents may be editing the repo and they must not revert unrelated changes.
- Require each worker to report changed files, tests run, blockers, and intent evidence.
- The orchestrator remains responsible for integration and final validation.

## Documentation Contracts

For coding goals, the execution plan is the controlling local artifact. Use:

```text
implementation-goals/templates/EXECUTION_PLAN.md
implementation-goals/templates/CONTEXT_PACKAGE.md
implementation-goals/templates/CODING_PROMPT.md
implementation-goals/templates/VALIDATION_REPORT.md
docs/process/INTENT_PRESERVATION_SYSTEM.md
docs/process/PROJECT_INVARIANTS.md
```

Do not mark a coding goal complete without validation evidence that maps back to backup safety invariants.

## Required Final Report Shape

Every implementation, merge, or validation session must end with:

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
