# Backups Microservice Intent Plan

Created: 2026-06-12

## Intent

Backups must be the disaster-recovery control plane for the Statex ecosystem. It must show and manage protected sources across microservices, starting with PostgreSQL databases backed up through WAL-G to MinIO, and it must later extend to object storage, Kubernetes resources, secrets, and PVCs.

The preserved intent is:

- Backups owns backup targets, schedules, retention policy, backup run history, restore requests, restore verification evidence, and operational backup status.
- Application services own their domain data and must not become independent, undocumented backup schedulers.
- Database Server owns PostgreSQL runtime; Backups coordinates backup and restore operations against approved targets.
- MinIO owns object storage runtime; Backups writes backup artifacts through configured S3-compatible settings without exposing credentials.
- Auth owns login, JWT, RBAC, and service identity. Backup management operations must remain protected.
- Vault/ESO owns secrets. UI and logs must show secret references only, not secret values.
- Restore to production targets is a human-approved operation because it can overwrite live data.

## Required Backup Source Classes

Backups must eventually cover more than filesystem paths and PostgreSQL dumps:

- PostgreSQL databases and service-owned schemas.
- MinIO/object storage buckets, media, exports, generated artifacts, and bucket metadata.
- Kubernetes PVCs and other persistent runtime volumes.
- Kubernetes manifests and cluster configuration: deployments, services, ingress, configmaps, external secret definitions, cronjobs, service accounts, RBAC, namespaces, and network policies.
- Vault secrets, encryption keys, signing keys, TLS private keys, and third-party credentials, backed up only through encrypted secret-safe mechanisms.
- Container image provenance: production image tags, digests, registry recovery path, Dockerfiles, and build inputs.
- Message/event infrastructure: broker definitions, durable queues, exchanges, bindings, dead-letter queues, and critical persisted messages.
- Search/vector stores and document indexes, plus source documents needed to rebuild them.
- Auth and identity configuration: roles, service identities, clients, token settings, and admin recovery path.
- Observability and audit evidence: logs, audit trails, monitoring configuration, alert rules, backup run history, restore history, and restore test results.
- DNS, TLS, edge routing, and external dependency configuration.
- Operational runbooks, RPO/RTO definitions, service dependency maps, schedules, retention policies, and recovery procedures.

A backup is recoverable only when the data, keys, manifests, image provenance, and restore instructions needed to rebuild the service are also protected.


## Coverage Source Contracts

Goal BAK-G5 defines these source categories as operator coverage metadata before full execution support:

- `postgres_database`: executable today through the existing WAL-G PostgreSQL path. Requires host, port, database name, Vault/Kubernetes secret reference, service owner, RPO/RTO, criticality, restore class, and verification evidence.
- `minio_bucket`: contract-only in Goal 05. Future implementation must protect bucket objects, metadata, lifecycle policy, encryption settings, and restore runbook without exposing object-store credentials.
- `kubernetes_resource`: contract-only in Goal 05. Future implementation must protect manifests and cluster configuration needed to recreate workloads, services, ingress, RBAC, configmaps, external secret definitions, and cronjobs.
- `secret_reference`: contract-only in Goal 05. Backups may track coverage and restore-class metadata for secret references, but secret values, private keys, tokens, and credentials remain owned by Vault/ESO and require encrypted secret-safe backup mechanisms.
- `pvc`: contract-only in Goal 05. Future implementation must record volume owner, namespace, storage class, snapshot or copy mechanism, restore runbook, and data-consistency requirements.

Unprotected discovered services shown by the dashboard are operator evidence only. They do not imply that Backups owns application-domain data or that unsupported source categories are protected.

## Current Findings

The service is deployed at `https://backups.alfares.cz`.

Public `/health` and `/info` work. Protected `/jobs` rejects unauthenticated requests with `401 Missing Authorization header`.

The source repo is `/home/ssf/Documents/Github/backups-microservice`, branch `main`.

The service is NestJS + TypeScript with static HTML pages under `web/`.

Current API modules support:

- `GET/POST/PATCH/DELETE /targets`
- `GET/POST/PATCH/DELETE /jobs`
- `GET /backups`, `POST /backups/trigger`, `DELETE /backups/:id`
- `GET/POST /restore`
- `GET /health`
- `GET /info`

Current persistence models are `backup_targets`, `backup_jobs`, `backup_runs`, and `restore_requests`.

Current target type is PostgreSQL only. WAL-G environment settings point to MinIO-compatible storage and use configured compression.

The existing admin frontend is functional but prototype-level: it uses a dark Tailwind CDN surface, requires raw UUID entry for manual backup and restore, does not show service coverage clearly, and does not surface guardrails or storage/retention settings in one place.

RAG confirms the approved original scope: scheduled PostgreSQL backups via WAL-G to MinIO, lightweight admin dashboard, auth/logging/notifications/Vault/K8s integration, and future target extensibility for MinIO object storage, K8s resources, secrets, and PVCs.

## Missing Implementation

1. Intent preservation artifacts
   - Backups had no repo-local orchestrator intent docs before this plan.
   - Human-owned `BUSINESS.md` and `GOALS.md` remain placeholders and should not be silently rewritten by agents.

2. Operator dashboard completeness
   - Operators need one console showing protected services, sources, schedules, retention, run status, restore history, and safety settings.
   - Current UI does not show target/job coverage or protection gaps clearly.
   - Current UI requires raw UUID typing where dropdowns should prevent operator error.

3. Restore verification
   - Docs state backups that cannot be restored are failures.
   - Current backup success path does not run restore verification or store verification outcome separately.
   - `BackupRunStatus.VERIFYING` exists but is not used.

4. Coverage inventory
   - Current target model can show configured databases but cannot yet distinguish microservice owner, criticality, RPO/RTO, or source category.
   - Future coverage should include MinIO buckets, Kubernetes manifests/resources, secrets, and PVCs.

5. Safety guardrails
   - The API still has `DELETE /backups/:id`; the RAG boundary says agents must not delete backup runs.
   - Retention minimum is validated as `>= 1`, but the boundary says retention below 3 full backups requires explicit owner approval.
   - Production restore requires stronger explicit approval semantics than the current confirm dialog.

6. Production observability
   - Health reports only service uptime, not database, MinIO/WAL-G readiness, schedule registration, or notification/logging integration state.
   - Dashboard summary had to be derived from several endpoints; it should be a first-class read-only API.

## Goal Sequence

### BAK-G1 - Add backup intent preservation and roadmap

Objective: Make future backup work follow the internal intent-preservation system.

Acceptance criteria:

- Backups has repo-local `docs/orchestrator/INTENT.md`.
- Backups has a goal sequence and evidence plan.
- Human-owned `BUSINESS.md` and `GOALS.md` remain unchanged.
- Drift checks name restore safety, retention, secret exposure, and ecosystem coverage.

### BAK-G2 - Build the backup management frontend

Objective: Give operators a clear UI for services/sources, schedules, retention, backup history, restore history, and settings.

Acceptance criteria:

- Dashboard shows target coverage, enabled jobs, recent runs, failed runs, latest success, storage backend, retention guardrails, and restore safety.
- Jobs page shows source database, schedule, retention, storage prefix, last run, and enabled state.
- New job creation uses a target dropdown rather than requiring raw target UUID entry.
- Restore page uses target selection and keeps destructive warnings visible.
- The UI handles unauthenticated API responses clearly.

### BAK-G3 - Add read-only dashboard summary API

Objective: Give the frontend a safe, single source for operational backup state.

Acceptance criteria:

- `GET /dashboard/summary` returns targets, jobs, recent runs, restore requests, storage settings, and guardrails.
- The endpoint does not expose secret values.
- Protected auth behavior remains consistent with other management endpoints.
- `npm run build` passes.

### BAK-G4 - Restore verification model

Objective: Treat restore verification as part of backup success evidence.

Acceptance criteria:

- Backup run status can represent verification lifecycle and result.
- Successful backup flow either runs a configured verification step or records why verification is pending/skipped.
- UI shows verification state per run and per target.
- Notifications distinguish backup success, verification success, and verification failure.

### BAK-G5 - Coverage model for all ecosystem sources

Objective: Move from database-only configuration toward full microservice backup coverage.

Acceptance criteria:

- Target/source model can identify service owner, source category, criticality, RPO/RTO, and restore class.
- PostgreSQL remains backward compatible.
- MinIO bucket, Kubernetes resource, secret, and PVC targets have documented contracts before implementation.
- Dashboard shows protected and unprotected configured services.

### BAK-G6 - Stronger safety and audit controls

Objective: Prevent unsafe retention, deletion, and restore behavior.

Acceptance criteria:

- Retention below three full backups requires explicit owner approval metadata.
- Backup run deletion is disabled or owner-gated with audit reason.
- Production restore requires explicit approval fields and actor evidence.
- Audit logs include actor, target, job, run, action, and reason.

### BAK-G7 - Production readiness and smoke tests

Objective: Make backup operations verifiable after each deploy.

Acceptance criteria:

- Smoke test covers health, info, protected endpoint rejection, dashboard summary, jobs, targets, and recent runs.
- Health/readiness reports database and storage readiness separately.
- Deploy script runs a meaningful post-rollout backup service smoke check.
- Evidence log is updated after each implementation cycle.

## First Next Step

Implement BAK-G1 through BAK-G3 first. The owner asked for a frontend, but the frontend must be anchored to the intent-preservation system and a safe read-only summary endpoint before deeper backup behavior changes.

After BAK-G3, implement BAK-G4 because the highest disaster-recovery risk is false confidence from backups that have not been restore-verified.

## Future Session Protocol

Each future session should:

1. Re-read `BUSINESS.md`, `SYSTEM.md`, `AGENTS.md`, `TASKS.md`, `STATE.json`, `docs/orchestrator/INTENT.md`, and this file.
2. Query docs RAG before reading source.
3. Re-run baseline checks before editing:
   - `npm run build`
   - `npm test -- --runInBand`
   - `curl -sk https://backups.alfares.cz/health`
   - `curl -sk https://backups.alfares.cz/info`
   - `curl -sk -o /dev/null -w "%{http_code}\n" https://backups.alfares.cz/jobs`
4. Work on the earliest unfinished goal unless the owner explicitly chooses another goal.
5. Preserve the ownership boundaries:
   - Backups owns backup orchestration and restore evidence.
   - Database Server owns PostgreSQL runtime.
   - MinIO owns object storage runtime.
   - Vault owns secrets.
   - Auth owns identity and RBAC.
   - Application services own their domain data.
6. Do not edit `BUSINESS.md` or `GOALS.md` without explicit owner approval.
7. Append evidence/status notes rather than silently changing preserved intent.

## Evidence Log

- 2026-06-12: RAG query confirmed approved scope: WAL-G logical PostgreSQL backups to MinIO, static admin dashboard, auth/logging/notifications/Vault/K8s integration, and future target extensibility.
- 2026-06-12: Public production `/health` and `/info` returned healthy service metadata.
- 2026-06-12: Production `/jobs` without Authorization returned `401`, confirming the management API is protected.
