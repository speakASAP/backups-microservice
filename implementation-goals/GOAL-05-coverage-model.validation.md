# VAL-BAK-G5: Ecosystem Coverage Model Validation

```yaml
id: VAL-BAK-G5
status: passed
validated_artifact: implementation-goals/GOAL-05-coverage-model.md
owner: validator
created: 2026-06-13
last_updated: 2026-06-13
completeness_level: complete
```

## Artifact Validated

Target: `BAK-G5 Ecosystem Coverage Model` on `codex/backups-goal-05-coverage-model`.

## Validation Scope

Validated target/source coverage metadata schema, PostgreSQL backward compatibility, contract-only source category safety, dashboard summary and admin UI visibility, secret exposure and ownership invariants, and state updates.

## Evidence

- Added coverage metadata migration for `backup_targets` with backward-compatible PostgreSQL defaults.
- Added `JobsService.create` guard that rejects executable jobs for non-`postgres_database` targets.
- Added dashboard `source_contracts` metadata for implemented PostgreSQL support and contract-only MinIO, Kubernetes resource, secret reference, and PVC categories.
- Added admin UI source-contract rendering and UI guard against contract-only target-and-schedule creation.
- Added `test/backup-target-enums.spec.ts` for coverage enum contracts.
- Narrowed `.gitignore` backup artifact patterns so backup source/test files remain visible to Git.

## Gate Evidence

| Gate | Status | Evidence |
|---|---|---|
| Documentation gate | pass | Plan, context, coding prompt, and validation shell existed before source edits. |
| Build | pass | `npm run build` completed successfully. |
| Tests | pass | `npm test -- --runInBand` passed: 3 suites, 8 tests. |
| Frontend syntax | pass | `node --check web/admin/app.js` completed with no syntax errors. |
| Diff hygiene | pass | `git diff --check` passed. |
| Secret scan | pass | Changed-file scan found policy/reference text only; no secret values, credentials, signed URLs, raw data, `walg_output`, or `storage_path` exposure added. |
| Contract-only safety | pass | `JobsService.create` rejects non-PostgreSQL targets; admin UI blocks contract-only schedule creation. |

## Backup Safety Evidence

| Invariant | Status | Evidence |
|---|---|---|
| `BAK-INV-001` ownership | pass | Changes add coverage metadata and contracts only; no application-domain data ownership added. |
| `BAK-INV-003` secret handling | pass | Secret references remain references only; source contracts explicitly forbid credential values. |
| `BAK-INV-004` coverage visibility | pass | Dashboard summary/UI expose source contracts, protected coverage, and discovered gaps. |
| `BAK-INV-006` audit/risk operations | pass | No destructive operation was added or changed. |
| `BAK-INV-007` extensibility | pass | New source categories are contract-only and PostgreSQL defaults remain backward compatible. |
| `BAK-INV-008` auth boundary | pass | Controllers/guards were not weakened. |
| `BAK-INV-009` IPS chain | pass | Goal 05 execution plan, context package, coding prompt, validation report, code changes, validation, and state updates exist. |

## Passed Criteria

- Target/source model identifies service owner, source category, criticality, RPO/RTO, and restore class.
- PostgreSQL behavior remains backward compatible.
- MinIO bucket, Kubernetes resource, secret reference, and PVC categories are documented and visible as contract-only.
- Dashboard shows protected and unprotected configured/discovered sources and source contract metadata.
- Build, tests, frontend syntax, and diff hygiene passed.

## Failed Criteria

None.

## Deviations

- Modified `.gitignore` because broad `*backup*` rules hid the new backup-target test from Git. This matches the repository hygiene fix already recorded by Goal 04.

## Recommendation

Goal 05 is implementation-complete and validated on the remote filesystem. Next action: implement Goal 06 safety audit controls after owner review.
