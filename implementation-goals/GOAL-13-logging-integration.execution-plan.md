# Execution Plan: BAK-G13 LoggingModule Integration

## Scope

Add structured operation logging to the existing shared logger and route key backup control-plane lifecycle events through it.

## Invariants Checked

- BAK-INV-001: Keep logging limited to backup control-plane evidence and operations.
- BAK-INV-002: Do not alter restore approval requirements.
- BAK-INV-003: Redact secret-like metadata and traces before file or remote logging.
- BAK-INV-004: Keep verification status visible as distinct operation events.
- BAK-INV-006: Add logging as operational evidence without replacing persisted audit records.
- BAK-INV-009: Maintain plan, context, prompt, validation, and state evidence.

## Steps

1. Add log level/event types, recursive redaction, remote payload shaping, and `operation()` helper to `LoggerService`.
2. Keep Nest `log`, `warn`, `error`, `debug`, and `verbose` compatibility.
3. Add structured operation events in backup, restore, retention, jobs, and audit services.
4. Add focused logger service tests.
5. Run build/tests/smoke shell/diff checks and update state docs.

## Safety Notes

Logging must never include raw WAL-G output, passwords, tokens, secret refs, authorization headers, or storage artifact paths. Remote logging failures must be swallowed after local warning/file evidence.
