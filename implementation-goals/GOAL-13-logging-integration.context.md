# Context Package: BAK-G13 LoggingModule Integration

## Current Behavior

- `shared/logger/LoggerService` implements Nest's logger interface.
- It writes local `logs/<level>.log` and `logs/all.log` files.
- It optionally posts to `${LOGGING_SERVICE_URL}/api/logs`, but payloads are message-oriented and not typed around backup operations.
- Current call sites use string messages in backup, restore, retention, WAL-G, notification, and schema readiness paths.

## Constraints

- RAG context lookup failed with curl code 6 because the internal docs RAG hostname was not resolvable from the remote shell. Local intent docs were used.
- Logging must be best-effort and must not break backup execution, restore execution, retention cleanup, or audit persistence.
- Logging is additive operational evidence and does not replace the `audit_events` table.

## Implementation Decision

Keep the existing logger module and HTTP transport. Add a structured `operation()` facade with recursive redaction and route important lifecycle events through it.
