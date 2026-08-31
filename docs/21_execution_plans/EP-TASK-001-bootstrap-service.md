# Execution Plan: TASK-001 canonical IPS adoption

```yaml
id: EP-TASK-001-bootstrap-service
status: implemented
owner: backups-microservice
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: complete
```

## Upstream Traceability

`../11_tasks/TASK-001-bootstrap-service.md`, `../22_goal_impact/GOAL-IMPACT-TASK-001.md`, and `../12_validation/VAL-TASK-001-bootstrap-service.md` define the bootstrap chain.

## Scope

Produce canonical IPS documents and profile metadata from the repository’s existing approved intent, process, state, registry, configuration, and source evidence.

## Non-Goals

No source, schema, runtime, deployment, or policy behavior changes are included.

## Project Invariants

Preserve the numbered rules in `docs/orchestrator/INTENT.md`, summarized by `docs/17_governance/PROJECT_INVARIANTS.md` and detailed in `docs/process/PROJECT_INVARIANTS.md`.

## Sensitive-Data Handling

Use names and configuration roles only; never include secret values, backup content, or private operational evidence.

## Contract Validation Plan

Confirm documented PostgreSQL, MinIO, JWT, notifications, health, and schedule claims against service source and Kubernetes configuration.

## Replay and Determinism Plan

Document existing deterministic archive retrieval, not a new replay mechanism; do not alter backup or restore execution.

## Files to Inspect

Root documentation, `docs/orchestrator/INTENT.md`, process invariants, validation debt, registry files, `src/`, `k8s/`, and the authoritative validator.

## Files to Create

The canonical constitution, vision, integration contract, invariants, bootstrap task, goal impact, execution plan, validation report, and `ips-adoption.json`.

## Files to Modify

`BUSINESS.md`, `SYSTEM.md`, `README.md`, `AGENTS.md`, `AGENT_OPERATIONS.md`, `TASKS.md`, `STATE.json`, and the existing validation-debt ledger.

## Files That Must Not Be Modified

`docs/orchestrator/INTENT.md`, `GOALS.md`, source, tests, Kubernetes configuration, deployment scripts, and central ecosystem configuration.

## Implementation Steps

1. Scaffold canonical paths non-destructively.
2. Reconcile content against existing intent and runtime evidence.
3. Complete profile decisions and canonical traceability.
4. Validate and correct diagnostics.

## Parallel Execution

Ready now: one documentation integration stream owned by the adoption worker. Shared artifacts are only edited by that owner; validation follows integration.

## Blockers

No blocker prevents canonical adoption. Numeric RPO/RTO targets are intentionally recorded as an owner open question rather than invented.

## Test Plan

Run the planning adoption validator; no runtime test is needed because no executable files change.

## Validation Plan

Require zero validator errors and inspect that original detailed safety rules remain unchanged.

## Gate Commands

`python3 intent-preservation-system/scripts/validate_adoption_profile.py --root backups-microservice --phase planning`

## Documentation Updates

Update canonical artifacts and reformat the existing validation-debt ledger while retaining its substantive entry history.

## Rollback Plan

Revert only this documentation/profile commit if canonical documentation proves inaccurate; do not alter runtime state.

## Handoff

The completed profile points future work to the detailed intent, invariant, and debt records. Numeric RPO/RTO targets require project-owner definition.

## Completion Checklist

- Canonical artifact paths are populated.
- Existing safety rules are cross-referenced, not replaced.
- All capabilities receive a concrete decision.
- The planning validator succeeds.
