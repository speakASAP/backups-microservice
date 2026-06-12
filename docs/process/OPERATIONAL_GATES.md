# Backups Operational Gates

```yaml
id: BAK-OPERATIONAL-GATES
status: reviewed
owner: orchestrator
created: 2026-06-12
last_updated: 2026-06-12
completeness_level: complete
upstream:
  - docs/process/INTENT_PRESERVATION_SYSTEM.md
  - docs/process/PROJECT_INVARIANTS.md
  - docs/orchestrator/INTENT.md
downstream:
  - docs/IMPLEMENTATION_ORCHESTRATOR.md
  - implementation-goals/README.md
related_adrs: []
```

## Gate Timing

Run the narrowest relevant gate before editing code, before marking a goal complete, and before deployment.

## Gate Sequence

| Gate | Timing | Blocks on |
|---|---|---|
| Intake gate | before selecting work | missing required docs, unclear active goal, dirty worktree risk not recorded |
| Pre-coding gate | before source edits | missing traceability, execution plan, context package, coding prompt, validation shell, invariants, or sensitive-data policy |
| Integration-readiness gate | before combining changes | failed build/tests, contract mismatch, missing replay/idempotency evidence, or invariant violations |
| Deployment-readiness gate | before deployment | failed pre-coding/integration gate, missing validation report, unresolved `[MISSING: ...]`, protected document changes, or missing owner approval |

## Documentation Gate

Before coding:

```bash
test -f docs/orchestrator/INTENT.md
test -f docs/IMPLEMENTATION_STATE.md
test -f docs/process/INTENT_PRESERVATION_SYSTEM.md
test -f docs/process/PROJECT_INVARIANTS.md
test -f implementation-goals/README.md
test -f implementation-goals/templates/EXECUTION_PLAN.md
```

Check that the selected goal has:

- objective;
- upstream traceability;
- goal impact;
- acceptance criteria;
- non-goals;
- files to inspect;
- validation plan;
- safety and secret-handling notes.

For coding goals, also check that these exist before source edits:

```text
implementation-goals/GOAL-XX-*.execution-plan.md
implementation-goals/GOAL-XX-*.context.md
implementation-goals/GOAL-XX-*.coding-prompt.md
implementation-goals/GOAL-XX-*.validation.md
```

## Invariant Gate

Before coding and before marking a goal complete, check the applicable rows in `docs/process/PROJECT_INVARIANTS.md`.

Required evidence:

- invariant IDs checked;
- status for each invariant;
- files or commands used as evidence;
- explicit owner approval for any exception.

## Code Gates

Use the narrowest checks that apply:

```bash
npm run build
npm test -- --runInBand
node --check web/admin/app.js
```

If dependencies are unavailable, record the failure and the reason in `docs/IMPLEMENTATION_STATE.md`.

## Integration-Readiness Gate

Before merging, combining worker output, or declaring a coding goal complete, verify:

- all changed files are inside the execution-plan scope or deviations are recorded;
- build/test/frontend syntax checks pass or blockers are documented;
- schema/API/UI contract changes are reflected in validation evidence;
- replay, idempotency, or deterministic behavior is addressed when backup or restore state transitions changed;
- no unresolved `[MISSING: ...]` marker remains in completed artifacts unless it is explicitly owner-owned and non-blocking.

## Runtime Gates

For local or deployed verification, prefer:

```bash
curl -sk https://backups.alfares.cz/health
curl -sk https://backups.alfares.cz/info
curl -sk -o /dev/null -w "%{http_code}\n" https://backups.alfares.cz/jobs
```

Management endpoints should reject unauthenticated requests unless explicitly public.

## Safety Gates

Before completing a goal, verify:

- no secret values were added to source, docs, logs, UI, prompts, reports, or tests;
- production restore cannot be triggered accidentally;
- retention below three full backups is blocked or owner-approved;
- backup run deletion is disabled or owner-gated with audit reason;
- restore verification evidence is recorded or explicitly pending/skipped with reason;
- UI and API responses do not expose raw credentials or sensitive artifact paths.

## Failure Policy

If a gate fails:

1. Stop advancement to the next goal.
2. Record the failed command or manual check.
3. Mark the goal `blocked` or keep it `active`.
4. Add the concrete next action to `docs/IMPLEMENTATION_STATE.md`.

## Evidence Locations

Use:

```text
implementation-goals/GOAL-XX-*.validation.md
reports/validation/
docs/IMPLEMENTATION_STATE.md
```

Gate evidence must include command executed, target artifact, status, failed checks, invariant evidence, sensitive-data scan result, and next action.
