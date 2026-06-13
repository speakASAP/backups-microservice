# Backups Implementation State

Last updated: 2026-06-13.

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
BACKUPS ORCHESTRATOR: implement goal number 7
```

## Current Status

- Active goal: none
- Active branch: `codex/backups-goal-05-coverage-model`
- Current wave: Wave 7 - Configurable schedule policies implemented; deployment deferred for owner approval
- Completed goals: 01 Intent Preservation And Roadmap, 02 Operator Dashboard Frontend, 03 Dashboard Summary API, 04 Restore Verification Evidence, 05 Ecosystem Coverage Model, 06 Safety And Audit Controls, 07 Production Readiness And Smoke Tests, 08 PostgreSQL Schema Namespace And Migrations, 09 Nightly PostgreSQL Backup To MinIO, 10 Configurable Cron Schedule Policies
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
- Deployment status: deployed after owner instruction; image `localhost:5000/backups-microservice:aa2f4911-dirty-20260613064342`; full smoke passed after automated startup schema-readiness hardening
- Commit policy: do not commit or push unless the owner explicitly asks

## Goal Roadmap

| Goal | File | Status | Branch | Depends On | Parallel Notes |
|---|---|---|---|---|---|
| 01 | `implementation-goals/GOAL-01-intent-preservation.md` | done | `main` | none | Existing intent docs created |
| 02 | `implementation-goals/GOAL-02-operator-dashboard.md` | done | `main` | 01 | Existing admin frontend prepared |
| 03 | `implementation-goals/GOAL-03-dashboard-summary-api.md` | done | `main` | 01, 02 | Existing summary API prepared |
| 04 | `implementation-goals/GOAL-04-restore-verification.md` | done | `codex/backups-goal-04-restore-verification` | 03 | Validated on remote filesystem |
| 05 | `implementation-goals/GOAL-05-coverage-model.md` | done | `codex/backups-goal-05-coverage-model` | 03 | Validated on remote filesystem |
| 06 | `implementation-goals/GOAL-06-safety-audit-controls.md` | done | `codex/backups-goal-05-coverage-model` | 04, 05 | Completed with recorded branch deviation because Goal 05 changes were uncommitted |
| 07 | `implementation-goals/GOAL-07-production-readiness.md` | done | `codex/backups-goal-05-coverage-model` | 04, 05, 06 | Completed with recorded branch deviation because Goal 05/06 changes were uncommitted |
| 08 | `implementation-goals/GOAL-08-postgres-schema-migrations.md` | implemented-not-deployed | `codex/backups-postgres-schema-migrations` | 07 | Schema namespace move requires owner-approved deployment |
| 09 | `implementation-goals/GOAL-09-nightly-pgbackup-minio.md` | implemented-not-deployed | `codex/backups-nightly-pgbackup` | 08 | Enables default nightly scheduler metadata; deploy requires owner approval |
| 10 | `implementation-goals/GOAL-10-configurable-schedules.md` | implemented-not-deployed | `codex/backups-schedule-policies` | 09 | Schedule policy schema/config semantics; deploy requires owner approval |

## Execution Waves

| Wave | Goals | Mode | Gate Before Next Wave |
|---|---|---|---|
| 1 | 01, 02, 03 | completed baseline | intent docs, dashboard, and summary API exist |
| 2 | 04 Restore Verification | sequential | backup run verification state and UI evidence validated |
| 3 | 05 Coverage Model + 06 Safety Controls | mostly sequential; exploration may be parallel | service coverage, retention, deletion, and restore approval controls validated |
| 4 | 07 Production Readiness | completed sequentially | smoke tests, readiness checks, and deploy evidence documented; production deploy still requires owner approval |

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
2026-06-13: Implemented BAK-G10 configurable cron schedule policies on `codex/backups-schedule-policies`. Added schedule policy normalization for hourly, daily, weekly, and custom cron schedules; added policy fields to job entity/DTOs/schema readiness/initial migration; normalized job create/update schedules into `schedule_cron`; kept existing cron execution path; and updated nightly bootstrap to store its configured cron as `custom_cron`. Validation: `npm run build` passed; `npm test -- --runInBand` passed with 7 suites and 24 tests; `bash -n scripts/smoke-test.sh` passed; `git diff --check` passed. No backup was triggered, no backup deletion or restore was performed, and no secret values were exposed. Deployment deferred for owner approval because this changes job schedule configuration semantics.
2026-06-13: Implemented BAK-G9 nightly PostgreSQL backup to MinIO on `codex/backups-nightly-pgbackup`. Added `NightlyBackupBootstrapService` to create/update a default PostgreSQL target and enabled nightly backup job from env before cron registration; kept WAL-G `pgbackup --full-backup` as the execution path; added config defaults and focused tests. Validation: `npm run build` passed; `npm test -- --runInBand` passed with 6 suites and 20 tests; `bash -n scripts/smoke-test.sh` passed; `git diff --check` passed. No backup was triggered, no backup deletion or restore was performed, and no secret values were exposed. Deployment deferred for owner approval because it enables automatic nightly scheduling.
2026-06-13: Implemented BAK-G8 PostgreSQL schema namespace and migrations on `codex/backups-postgres-schema-migrations`. Added validated database schema helper, configured TypeORM app/data-source with `DB_SCHEMA` defaulting to `backups`, added `DB_SCHEMA: backups` to Kubernetes config, made startup schema readiness create the schema and move legacy `public` Backups tables into it idempotently, added migration run/show scripts, and updated initial migration to create the configured schema. Validation: `npm run build` passed; `npm test -- --runInBand` passed with 5 suites and 17 tests; `bash -n scripts/smoke-test.sh` passed; `git diff --check` passed. No destructive schema operation, backup deletion, or restore was performed. Deployment deferred for owner approval because this moves production table namespace.
2026-06-13: Implemented nearest follow-up hardening after BAK-G7: added startup `SchemaReadinessService` and module, invoked it before `app.listen`, and covered it with focused Jest tests. The service applies only additive idempotent schema alignment for Goal 4/5/6 fields/tables and can be disabled with `BACKUPS_APPLY_SCHEMA_READINESS=false`. Validation: `npm run build` passed; `npm test -- --runInBand` passed with 5 suites and 15 tests; `bash -n scripts/smoke-test.sh` passed; `git diff --check` passed; deployed image `localhost:5000/backups-microservice:aa2f4911-dirty-20260613064342`; rollout, health, readiness, and full authenticated smoke passed. Pod logs confirmed schema readiness completed before service listen. No destructive backup deletion or restore was performed. No commit or push was performed.
2026-06-13: Completed and deployed BAK-G7 production readiness on `codex/backups-goal-05-coverage-model` with recorded branch deviation. Added `/health/readiness` with separate database and storage readiness, moved Kubernetes readiness probe to `/health/readiness`, added `scripts/smoke-test.sh` for non-destructive public and authenticated protected read checks, added `npm run smoke`, and wired deploy to run readiness plus smoke checks after rollout. Generated Backups-owned `SERVICE_TOKEN` and `JWT_TOKEN` on `alfares`, patched Vault path `secret/prod/backups-microservice` without printing values, and forced ExternalSecret reconciliation. Deployment built/pushed image `localhost:5000/backups-microservice:aa2f4911-dirty-20260613063446`, applied manifests, rolled out successfully, and passed health/readiness. First authenticated smoke found missing prior Goal 6 DB columns; applied additive schema readiness patch (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`) through the Backups pod. Final smoke passed for health, readiness, info, unauthenticated `/jobs` HTTP 401, authenticated dashboard summary, jobs, targets, and recent backup runs. Validation: `npm run build` passed; `npm test -- --runInBand` passed with 4 suites and 12 tests; `bash -n scripts/smoke-test.sh` passed; `git diff --check` passed; full production smoke passed. No destructive backup deletion or restore was performed. No commit or push was performed.
2026-06-13: Completed BAK-G6 safety audit controls on `codex/backups-goal-05-coverage-model` with recorded branch deviation. Added audit event persistence, low-retention owner approval metadata and validation, backup-run deletion denial with audit evidence, production restore approval fields and exact target/run confirmation, sanitized restore public serialization, focused safety tests, and admin UI friction for low retention and restore. Validation: `npm run build` passed; `npm test -- --runInBand` passed with 4 suites and 12 tests; `node --check web/admin/app.js` passed; `git diff --check` passed; unauthenticated `https://backups.alfares.cz/jobs` returned `401`; safety scan found no new secret values and no backup-run repository removal path.
2026-06-13: Completed BAK-G5 coverage model on `codex/backups-goal-05-coverage-model`. Added/verified target coverage metadata migration, documented source contracts for PostgreSQL, MinIO buckets, Kubernetes resources, secret references, and PVCs, added PostgreSQL-only executable job guard, updated dashboard/admin UI to show coverage classes, source contracts, and discovered unprotected sources, added focused coverage enum tests, and narrowed broad backup ignore rules. Validation: `npm run build` passed; `npm test -- --runInBand` passed with 3 suites and 8 tests; `node --check web/admin/app.js` passed; `git diff --check` passed. Secret/safety scan found only policy text and safe reference strings, not secret values.
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
- Backup run deletion is now disabled at the service layer and denied attempts are audited. Future owner decision may add a gated archival workflow if needed.
- Which service inventory source becomes canonical for coverage gaps. Goal 05 currently treats Kubernetes discovery as operator evidence, not the canonical inventory source.

## Next Action

Commit/review request or operational handoff.

Goal 10 configurable schedule policies are ready for review. Next action is owner approval for deployment, or continue with RestoresModule restore from MinIO plus verify.
