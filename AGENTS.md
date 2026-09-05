# Repository Agent Instructions

Shared rules live here:

- Codex profile: `/home/ssf/.codex/AGENTS.md`
- Cross-agent standard: `/home/ssf/.ai-agent-standards/CROSS_AGENT_AUTOMATION_STANDARD.md`
- Repository operations: `AGENT_OPERATIONS.md`

Read those first, then follow the repository-specific notes below and the current planning/status files.


## Repository-Specific Notes

# AGENTS.md — backups-microservice


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

## Knowledge Retrieval

Use `docs-rag-microservice` for bounded discovery when it is healthy, then
verify deployment, security, database, integration and public-contract facts
against the cited Git source. Git remains authoritative.

Authority and fallback rules:
`/home/ssf/Documents/Github/shared/docs/DOCUMENTATION_AUTHORITY.md`.

Do not generate tokens in documentation or assume an unconfident/failed RAG
response means that source documentation does not exist.

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

- Never modify BUSINESS.md
- Secrets always via Vault, never hardcoded
- Do not delete backup runs or perform production restore without explicit human approval and recorded reason
- Do not mark a goal complete without validation evidence or a recorded blocker
- Do not write code from vague intent; preserve `Original Intent -> Goal Impact -> Execution Plan -> Context Package -> Coding Prompt -> Code -> Validation -> Evidence`

## Authority

The project owner approves policy, secrets, production restore, and retention exceptions. Agents may create targets/jobs and trigger backups, but cannot delete backup runs or restore production without human approval.

## Service-to-service authentication
Any call this service makes to, or receives from, another service is governed by
[`auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md`](../auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md).
Read it before writing or debugging a machine call — including a 401 from an internal
endpoint. New machine paths use an Auth-issued per-pair RS256 service JWT; a shared static
token is legacy and closed to new adopters.

## Intent Preservation System

Preserve `Vision -> Goal Impact -> System -> Feature -> Task -> Execution Plan -> Coding Prompt -> Code -> Validation`. Detailed rules remain in `docs/orchestrator/INTENT.md`; canonical summary is `docs/17_governance/PROJECT_INVARIANTS.md`.

## Safety and Operations

Keep secrets in Vault/Kubernetes references, preserve restore evidence, and require approval for retention below three full backups.

## Project-Specific Rules

Future target types must preserve PostgreSQL behavior. Production restores require target, backup run, actor, and reason evidence.

## Required Final Report

Report files changed, validation evidence, debt, blockers, deviations, and next action.
