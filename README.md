# backups-microservice

Backups is the ecosystem durability control-plane service for backup orchestration and restore evidence.

## Status

The service is active; current delivery evidence is tracked in `STATE.json` and `TASKS.md`.

## Documentation Authority

`docs/orchestrator/INTENT.md` is the detailed service safety source. Canonical IPS documents carry traceability; central standards live in `intent-preservation-system`.

## Capabilities

Backup targets, scheduled PostgreSQL archives, MinIO-compatible storage, restore verification, retention guardrails, and operator status.

## Interfaces

`GET /health` and authenticated backup/restore management routes are service interfaces.

## Development

Use `npm run build` and `npm run test`; migrations run explicitly with TypeORM synchronization disabled.

## Configuration

Configuration defines port, database host, schedule, retention, and storage bucket. Database, JWT, and MinIO credentials arrive through Vault/ESO.

## Deployment

Deploy through `./scripts/deploy.sh` into `statex-apps`; use the shared rollout wait script.

## Health and Observability

`GET /health` returns 200 with status ok. Status, logging, notifications, and monitoring provide operational evidence.

## Service snapshot

- Service: `backups-microservice`
- Runtime: NestJS + TypeScript
- Port: `3398`
- Domain: `backups.alfares.cz`
- Namespace: `statex-apps`
- Health endpoint: `GET /health`

## Documentation entry points

- `AGENTS.md` - repository agent rules and orchestrator entrypoint
- `SYSTEM.md` - deployment/runtime contract and environment mapping
- `TASKS.md` - current backlog and operator task tracking
- `STATE.json` - machine-collectable planning/delivery state
- `docs/IMPLEMENTATION_STATE.md` - implementation history and validation evidence
- `docs/orchestrator/INTENT.md` - intent-preservation guardrails
