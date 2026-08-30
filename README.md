# backups-microservice

Backups is the ecosystem durability control-plane service for backup orchestration and restore evidence.

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
