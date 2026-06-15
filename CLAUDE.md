# Claude Instructions

Shared rules live here:

- Claude profile: `/home/ssf/.claude/CLAUDE.md`
- Shared ecosystem instructions: `/home/ssf/Documents/Github/CLAUDE.md`
- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`
- Repository operations: `AGENT_OPERATIONS.md`

Read those first, then follow the repository-specific notes below and the current planning/status files.


## Repository-Specific Notes

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

→ Ecosystem: [../shared/CLAUDE.md](../shared/CLAUDE.md) | Reading order: `BUSINESS.md` → `SYSTEM.md` → `AGENTS.md` → `TASKS.md` → `STATE.json` → `docs/orchestrator/INTENT.md` → `docs/orchestrator/backup-intent-plan.md`

---

## Knowledge Retrieval — docs-rag-microservice (MANDATORY, query before reading files)

**Query the RAG before reading source files** — saves 2000-5000 tokens per answer.

```bash
kubectl -n statex-apps exec deployment/backups-microservice -- curl -s -X POST http://docs-rag-microservice:3397/retrieval/agent-context \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat ~/.claude/rag-token)" \
  -d '{"query": "YOUR QUESTION HERE", "maxTokens": 3000}'
```

---

## backups-microservice

**Purpose**: Centralized backup management — database, MinIO object storage, K8s resources, secrets.
**Port**: 3398 (K8s ClusterIP + Ingress at backups.alfares.cz)
**Stack**: NestJS, TypeScript, PostgreSQL (schema: `backups`), MinIO

## Commands

```bash
npm run build          # compile TypeScript → dist/
npm run start:dev      # watch mode, port 3398
npm run test           # jest
npm run test:watch     # jest --watch
npm run test:cov       # with coverage
npm run lint           # eslint src --ext .ts
```

Run a single test:
```bash
npx jest src/modules/backups/backups.service.spec.ts
```

## Deploy

```bash
./scripts/deploy.sh
# First deploy: kubectl apply -f k8s/ -n statex-apps
```

## Architecture

NestJS monolith with scheduler. Key modules:

- **BackupsModule** — `POST /api/backups/trigger`, `GET /api/backups` — backup jobs CRUD and manual trigger
- **SchedulesModule** — cron-driven backup schedule management (`@nestjs/schedule`)
- **RestoresModule** — `POST /api/restores`, `GET /api/restores/:id` — restore job tracking
- **HealthModule** — `GET /health` → 200 OK (K8s probes)

Database: TypeORM, `synchronize: false`, schema `backups`. Migrations run manually.

## Integrations

- `auth-microservice:3370` — JWT validation
- `logging-microservice:3367` — structured logs
- `notifications-microservice:3368` — backup success/failure alerts
- `minio-microservice:9000` — backup storage
- `monitoring-microservice:3395` — health metrics
- `db-server-postgres:5432` — shared PostgreSQL (schema: `backups`)

## Config & Secrets

Non-sensitive vars in `k8s/configmap.yaml`. Secrets (DB_PASSWORD, JWT_SECRET, MINIO_ACCESS_KEY, MINIO_SECRET_KEY) in Vault at `secret/prod/backups-microservice` → synced via `k8s/external-secret.yaml`.

## Key constraints

- Backups that cannot be restored are failures — always run restore verification after backup
- Never hardcode credentials — all via Vault → ESO
- DB schema is always `backups` — never use public schema
- Preserve the intent plan before implementation: no secret exposure, no unsafe restore flow, no agent deletion of backup runs, and no retention below three full backups without explicit owner approval
