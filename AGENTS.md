# AGENTS.md — backups-microservice

## Remote Source Of Truth

- Work on the remote server alias `alfares` only.
- The project path is `/home/ssf/Documents/Github/backups-microservice`.
- All code changes must be made in that remote folder, not in local backup copies.
- Commits are allowed on the remote repository when work is complete and validated.
- Use `ssh alfares 'cd /home/ssf/Documents/Github/backups-microservice && <command>'` for one-off commands.

## Backups Orchestrator Entrypoint

When the user says:

```text
BACKUPS ORCHESTRATOR: continue implementation
```

or:

```text
Continue implementation of this project.
```

act as the Backups implementation orchestrator.

Do not ask the user which goal is next. Determine the next action from:

```text
docs/IMPLEMENTATION_STATE.md
docs/IMPLEMENTATION_ORCHESTRATOR.md
implementation-goals/README.md
```

Then continue from the latest checkpoint.

## Required Reading

Before implementation, branch orchestration, deployment, or launching workers, read:

```text
AGENTS.md
TASKS.md
STATE.json
docs/orchestrator/INTENT.md
docs/orchestrator/backup-intent-plan.md
docs/IMPLEMENTATION_STATE.md
docs/IMPLEMENTATION_ORCHESTRATOR.md
docs/AGENT_ORCHESTRATION.md
docs/process/INTENT_PRESERVATION_SYSTEM.md
docs/process/PROJECT_INVARIANTS.md
docs/process/OPERATIONAL_GATES.md
docs/orchestration/branch-workflow.md
implementation-goals/README.md
```

For a specific goal, also read the matching file in `implementation-goals/`.

## Core Intent

```text
Backups is the ecosystem disaster-recovery control plane.
It owns backup targets, jobs, backup run evidence, restore requests, restore verification, retention guardrails, and operator status.
It does not own application domain data, PostgreSQL runtime, MinIO runtime, Vault secrets, or Auth identity policy.
Secrets stay in Vault/Kubernetes references and must never be exposed in UI, logs, prompts, reports, or source.
Restore to production is destructive and requires explicit human approval with target, backup run, actor, and reason evidence.
Backups are not operationally successful unless restore capability or verification status is visible.
```

## Orchestrator Duties

1. Read `docs/IMPLEMENTATION_STATE.md`.
2. Identify the active goal, next ready goal, or blocked checkpoint.
3. Run only the next valid goal according to `implementation-goals/README.md`.
4. Use isolated branches or worktrees for parallel goals.
5. Keep write ownership disjoint when using workers or subagents.
6. Update `docs/IMPLEMENTATION_STATE.md`, `STATE.json`, and `TASKS.md` after every implementation session.
7. Require an `Intent Compliance Report` before marking a goal complete.
8. Run or document validation before moving to the next goal.
9. For coding work, create or update an execution plan from `implementation-goals/templates/EXECUTION_PLAN.md` before editing code.
10. Create or update context, coding prompt, and validation artifacts before implementation when the goal spans code or delegation.
11. Run the narrowest relevant gate from `docs/process/OPERATIONAL_GATES.md`.
12. Check project invariants from `docs/process/PROJECT_INVARIANTS.md`.
13. Do not deploy to production without explicit owner approval.

## User Checkpoints

The user should only need to review:

```text
goal completion reports
running app URLs or screenshots when available
validation summaries
merge conflict decisions if any
backup safety, retention, or restore approval deviations
production deployment approval
```

Ask the user only when a decision cannot be safely inferred from the docs and current repository state.

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
- Do not delete backup runs or perform production restore without explicit human approval and recorded reason
- Do not mark a goal complete without validation evidence or a recorded blocker
- Do not write code from vague intent; preserve `Original Intent -> Goal Impact -> Execution Plan -> Context Package -> Coding Prompt -> Code -> Validation -> Evidence`
