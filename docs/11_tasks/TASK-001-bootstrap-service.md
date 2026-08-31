# TASK-001: Canonical IPS adoption bootstrap

```yaml
id: TASK-001-bootstrap-service
status: completed
owner: backups-microservice
created: 2026-08-30
last_updated: 2026-08-30
completeness_level: complete
```

## Objective

Adopt the canonical IPS documentation standard for this already-running production backups service, consolidating existing intent-preservation content from `INTENT.md`, `PROJECT_INVARIANTS.md`, and `VALIDATION_DEBT.md` into canonical artifact locations.

## Upstream Links

`../22_goal_impact/GOAL-IMPACT-TASK-001.md`, `../21_execution_plans/EP-TASK-001-bootstrap-service.md`, and `../12_validation/VAL-TASK-001-bootstrap-service.md` provide the required bootstrap traceability.

## Goal Impact

The bootstrap makes established backup safety constraints discoverable in the canonical IPS chain without changing runtime behavior.

## Project Invariant Impact

The task preserves the detailed rules in `docs/orchestrator/INTENT.md` and summarizes them in the canonical invariants artifact.

## Sensitive-Data Classification

Documentation is internal operational metadata. Secret values, credentials, raw backup objects, and private evidence are excluded.

## Contract and Schema Impact

No runtime API, database schema, deployment contract, or integration behavior changes.

## Replay and Determinism Impact

No backup or restore execution changes. The documents record existing deterministic PostgreSQL object retrieval through `wal-g st cat` and `pg_restore`.

## Scope

Create canonical constitution, vision, integration, invariant, bootstrap, validation, and profile artifacts; complete root business/system/state metadata; preserve the existing detailed intent and debt ledger.

## Non-Goals

Do not modify source code, deployment configuration, existing `GOALS.md`, backup retention policy, or production state.

## Acceptance Criteria

All required canonical artifacts have concrete content, preserve safety rules, review every capability, and pass the planning-phase adoption validator.

## Required Context

`docs/orchestrator/INTENT.md`, `docs/process/PROJECT_INVARIANTS.md`, `docs/orchestrator/VALIDATION_DEBT.md`, runtime configuration, and source integration evidence.

## Validation Task

Run `python3 intent-preservation-system/scripts/validate_adoption_profile.py --root backups-microservice --phase planning` from the repository root.

## Required Gates

The planning adoption validator must return success; no deployment gate applies because this task changes documentation and profile metadata only.

## Parallel Workstream Context

Final integration is owned by the canonical-adoption worker. No parallel edits are assigned to the same canonical artifacts or status files.
