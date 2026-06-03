# AGENTS.md — backups-microservice


## Knowledge Retrieval (query before reading files)
Query the RAG service first to reuse indexed ecosystem context before reading raw files:

```bash
curl -s -X POST http://docs-rag-microservice.statex-apps.svc.cluster.local:3397/retrieval/agent-context \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "YOUR QUESTION HERE", "maxTokens": 3000}'
```

- Internal URL: `http://docs-rag-microservice.statex-apps.svc.cluster.local:3397`
- Public URL: `https://docs-rag.alfares.cz`
- Full guide: `docs-rag-microservice/docs/RAG_USAGE.md`

## Agent Boundaries

| Agent | Scope | Can modify |
|-------|-------|-----------|
| Claude Code | Implementation, K8s, deploy | src/, k8s/, scripts/, CLAUDE.md, TASKS.md, STATE.json |
| Human | Policy decisions, secrets | BUSINESS.md, GOALS.md, Vault secrets |

## Commands Agents May Run

```bash
# Deploy
./scripts/deploy.sh

# Check status
kubectl get pods -n statex-apps -l app=backups-microservice
kubectl logs -f deploy/backups-microservice -n statex-apps

# Health
curl https://backups.alfares.cz/health

# Trigger manual backup (when implemented)
curl -X POST https://backups.alfares.cz/api/backups/trigger
```

## Constraints

- Never modify BUSINESS.md or GOALS.md
- Never commit or push — ask user
- Secrets always via Vault, never hardcoded
