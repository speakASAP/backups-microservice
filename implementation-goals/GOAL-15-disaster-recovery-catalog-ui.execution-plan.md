# EP-BAK-15: Disaster Recovery Catalog UI

```yaml
id: EP-BAK-15
status: completed
source_goal: implementation-goals/GOAL-15-disaster-recovery-catalog-ui.md
owner: orchestrator
created: 2026-06-25
last_updated: 2026-06-25
completeness_level: implementation_ready
```

## Metadata

Owner: Codex worker. Branch: `codex/backups-phase1-catalog-support`. Lifecycle: owner-selected Phase 1 after Phase 0 catalog evidence.

## Upstream Traceability

- Original intent: `docs/orchestrator/INTENT.md`
- Consolidation plan: `docs/orchestrator/BACKUP_CONSOLIDATION_PLAN.md`
- Phase 0 catalog: `/home/ssf/Documents/Github/shared/runtime-evidence/disaster-recovery/latest.json`
- Project invariants: `docs/process/PROJECT_INVARIANTS.md`
- Operational gates: `docs/process/OPERATIONAL_GATES.md`

## Goal Impact

Operators get a dashboard-visible DR catalog before any payload migration, so Backups can distinguish protected inputs, keep-indexed evidence, legacy-review paths, do-not-touch references, and missing lanes.

## Backup Safety Invariants

- `BAK-INV-001`: Backups owns catalog/evidence visibility, not application data.
- `BAK-INV-002`: no restore execution or approval flow changes.
- `BAK-INV-003`: API/UI must not expose secret values, Kubernetes Secret `.data`, dump contents, encrypted archive contents, or root-only secret paths.
- `BAK-INV-004`: restore verification remains visible as `[UNKNOWN]` or `[MISSING]`, not claimed successful.
- `BAK-INV-006`: no destructive/risk-changing operation is added.
- `BAK-INV-008`: dashboard remains protected by existing auth guard.
- `BAK-INV-009`: goal artifacts and validation are recorded.

## Sensitive-Data Handling

Read only sanitized JSON. Sanitize the DR catalog before returning it from `/dashboard/summary`. Hide do-not-touch/root-only secret reference paths from API/UI. Do not read or list payload contents. Do not print or persist secrets.

## Contract/Schema Impact

API-only additive field: `external_evidence.disaster_recovery_catalog`. No database schema change. UI renders the additive field if present and degrades to `missing` if absent.

## Scope

Add a dashboard sanitizer, UI catalog rendering, read-only deployment mount, and focused sanitizer test.

## Non-Goals

No payload movement, deletion, checksum collection, restore execution, schedule change, mount/remount, deploy, commit, or push.

## Files To Inspect

- `src/dashboard/dashboard.service.ts`
- `web/admin/index.html`
- `web/admin/app.js`
- `web/admin/styles.css`
- `k8s/deployment.yaml`
- `docs/orchestrator/BACKUP_CONSOLIDATION_PLAN.md`

## Files To Create

- `test/dashboard-catalog.spec.ts`
- `implementation-goals/GOAL-15-disaster-recovery-catalog-ui.context.md`
- `implementation-goals/GOAL-15-disaster-recovery-catalog-ui.coding-prompt.md`
- `implementation-goals/GOAL-15-disaster-recovery-catalog-ui.validation.md`

## Files To Modify

- `src/dashboard/dashboard.service.ts`
- `web/admin/index.html`
- `web/admin/app.js`
- `web/admin/styles.css`
- `k8s/deployment.yaml`
- `implementation-goals/README.md`
- `docs/IMPLEMENTATION_STATE.md`
- `STATE.json`
- `TASKS.md`

## Files That Must Not Be Modified

`BUSINESS.md`, `GOALS.md`, secrets, raw payloads, cron/systemd/mount files, backup scripts, and production runtime data.

## Implementation Steps

1. Add `readDisasterRecoveryCatalog()` sanitizer to `DashboardService`.
2. Return `external_evidence.disaster_recovery_catalog` from summary.
3. Add read-only disaster-recovery evidence mount/env to Kubernetes deployment.
4. Render catalog families and missing lanes in admin dashboard.
5. Add sanitizer test for hidden secret reference paths.
6. Run validation gates and update state artifacts.

## Test Plan

Add focused Jest coverage for catalog sanitizer. Run full existing test suite.

## Validation Plan

Run build, test, frontend syntax, diff check, catalog JSON check, and unauthenticated endpoint check.

## Gate Commands

```bash
npm run build
npm test -- --runInBand
node --check web/admin/app.js
git diff --check
```

## Documentation Updates

Update Goal 15 artifacts, goal index, implementation state, `STATE.json`, and `TASKS.md`.

## Rollback Plan

Revert changed files on the branch. Since there is no deploy, rollback is repository-only and does not touch runtime payloads.

## Agent Handoff Prompt

Implement BAK-G15 by adding sanitized DR catalog support to `/dashboard/summary` and the admin dashboard. Do not expose secret values or root-only secret material paths. Do not deploy, commit, push, move payloads, or change schedules.

## Completion Checklist

- [x] Implementation complete
- [x] Tests complete
- [x] Validation evidence collected
- [x] Documentation updated
- [x] Deviations documented
