# Wave 0 Repository Contract Validation — 2026-08-30

## Scope

Docs-only adoption of the Wave 0 repository contract in `backups-microservice`:

- `README.md` (factual minimal service entrypoint)
- `STATE.json` normalized to schema `1.0`
- `docs/registry/REPOSITORY_PROFILE.json`
- `docs/registry/ARTIFACT_INDEX.json`

## Validation Evidence

- `python3 /home/ssf/Documents/Github/shared/scripts/validate-repository-profile.py --root . --json` -> `ok: true`, `error_count: 0`
- `python3 /home/ssf/Documents/Github/shared/scripts/build-artifact-index.py --root . --check --json` -> `ok: true`, deterministic ordering confirmed
- JSON/path checks (parse + relative path + file existence for state/profile/index + artifact paths) -> pass
- Forbidden reference scan for `.env`, secrets, `*.pem`, backups/dumps, `node_modules`, coverage, and raw/runtime evidence paths -> pass
- `git diff --check -- README.md STATE.json docs/registry/REPOSITORY_PROFILE.json docs/registry/ARTIFACT_INDEX.json docs/orchestrator/WAVE0_REPOSITORY_CONTRACT_VALIDATION.md` -> pass

## Notes

No runtime source files, deploy configuration, backups, secrets, or other repositories were modified.
RunLayer mappings remain unset by design (`null`) because repository docs do not declare authoritative IDs.
