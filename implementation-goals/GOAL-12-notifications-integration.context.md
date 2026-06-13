# Context Package: BAK-G12 NotificationsModule Integration

## Current Behavior

- `NotificationsService.send(event, message, details)` posts to `${NOTIFICATION_SERVICE_URL}/notify` when URL and token are configured.
- Backup success/failure, backup verification pending, restore completed/failed, and retention cleanup success call the generic sender.
- Retention cleanup failure currently logs a warning but does not notify.
- The sender catches transport errors and logs a warning.

## Constraints

- RAG context lookup failed with curl code 6 because the internal docs RAG hostname was not resolvable from the remote shell. Local intent docs were used instead.
- Notification tokens must stay in environment/Vault/Kubernetes and must not be printed.
- The notifications service contract is inferred from the existing `/notify` integration.

## Implementation Decision

Keep the existing HTTP transport and add a typed facade around it. This avoids a schema migration and keeps the runtime behavior best-effort while making event names and payload hygiene testable.
