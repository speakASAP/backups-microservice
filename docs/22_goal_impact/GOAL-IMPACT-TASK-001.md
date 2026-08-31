# Goal Impact: TASK-001 canonical IPS adoption

```yaml
id: GOAL-IMPACT-TASK-001
status: validated
owner: backups-microservice
created: 2026-08-30
last_updated: 2026-08-30
```

## Goal

Make the already-running backups service fully traceable through the canonical IPS artifact set.

## Contribution

The adoption connects existing disaster-recovery intent, safety rules, runtime facts, and validation-debt history without replacing the established detailed documentation.

## Success Metric

The planning adoption validator reports the profile valid with all 16 capabilities reviewed.

## Invariant Compatibility

The goal cross-references `docs/orchestrator/INTENT.md` and `docs/process/PROJECT_INVARIANTS.md`; it does not weaken restore approval, retention, secret, or agent-authority rules.

## Upstream and Downstream Links

Upstream: `../11_tasks/TASK-001-bootstrap-service.md`. Downstream: `../21_execution_plans/EP-TASK-001-bootstrap-service.md` and `../12_validation/VAL-TASK-001-bootstrap-service.md`.

## Validation Method

Run the canonical planning validator and inspect the documents for preserved cross-references and concrete capability decisions.
