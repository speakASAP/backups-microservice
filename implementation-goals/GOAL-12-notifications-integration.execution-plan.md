# Execution Plan: BAK-G12 NotificationsModule Integration

## Scope

Add a typed, secret-safe notification event contract and route backup, restore, verification, and retention success/failure events through it.

## Invariants Checked

- BAK-INV-001: Keep ownership limited to backup orchestration evidence.
- BAK-INV-002: Do not change restore approval requirements.
- BAK-INV-003: Redact secret-like notification details and do not print tokens.
- BAK-INV-004: Keep verification events distinct from backup success.
- BAK-INV-006: Preserve audit trail behavior; notification is additive.
- BAK-INV-009: Maintain execution plan, context, prompt, validation, and state evidence.

## Steps

1. Add notification event constants, payload sanitization, and typed helper methods.
2. Replace direct `send` calls in backup and restore flows with typed helpers.
3. Add retention failure notifications while keeping cleanup best-effort.
4. Add focused unit tests for the notification service.
5. Update goal validation and state docs after gates pass.

## Safety Notes

Notification dispatch must never throw into backup, restore, or retention control flow. Payloads must not include raw WAL-G output, storage paths, passwords, tokens, access keys, secret refs, or authorization material.
