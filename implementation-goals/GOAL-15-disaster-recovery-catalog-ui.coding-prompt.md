# CP-BAK-15: Disaster Recovery Catalog UI

```yaml
id: CP-BAK-15
status: completed
source_goal: implementation-goals/GOAL-15-disaster-recovery-catalog-ui.md
source_plan: implementation-goals/GOAL-15-disaster-recovery-catalog-ui.execution-plan.md
owner: orchestrator
created: 2026-06-25
last_updated: 2026-06-25
```

## Assignment

Add Phase 1 Backups GUI catalog support for the sanitized disaster-recovery catalog.

## Scope

Modify dashboard service, admin dashboard HTML/JS/CSS, Kubernetes read-only evidence mount, and focused tests. Update state docs after validation.

## Non-Goals

No deploy, commit, push, payload move/delete/copy, restore, checksum collection, schedule change, mount/remount, secret read, or raw archive listing.

## Safety Requirements

Sanitize all catalog data before API/UI exposure. Hide do-not-touch/root-only secret material paths. Preserve auth guard behavior and restore approval boundaries.

## Implementation Notes

Use `DISASTER_RECOVERY_CATALOG_PATH` with default `/var/lib/backups-evidence/disaster-recovery/latest.json`. Read only sanitized JSON. Add UI handling for missing catalog manifests.

## Validation Required

`npm run build`, `npm test -- --runInBand`, `node --check web/admin/app.js`, `git diff --check`, `jq .` on the Phase 0 catalog, and unauthenticated `/dashboard/summary` check.

## Report Required

Return files changed, checks run, validation evidence, risks, blockers, and intent compliance notes.
