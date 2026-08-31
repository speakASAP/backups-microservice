# Integration Contract: backups-microservice

## Purpose

Define verified service boundaries for backup orchestration and preserve safe degraded behavior.

## Capability Decisions

PostgreSQL and MinIO-compatible object storage are required for backup state and archives. JWT authentication, notifications, logging, docs-rag, and monitoring are required ecosystem integrations. Redis, AI, payments, catalog, orders, warehouse, invoices, and event bus are not required service dependencies; the backups domain works with generic protected targets rather than those business domains.

## Data Ownership

Backups owns backup targets, jobs, runs, restore jobs, retention, and verification evidence in the `backups` schema. Protected services own their domain data. Vault owns secret values; MinIO owns stored objects.

## Authentication and Authorization

Management routes use JWT validation. Auth owns identity policy. Production restore requires separate explicit human approval with target, backup run, actor, and reason evidence.

## Synchronous Dependencies

PostgreSQL supplies the `backups` schema and source data; WAL-G transfers logical archive objects to MinIO-compatible storage. Notification and logging integrations report operational outcomes. `GET /health` supports monitoring.

## Asynchronous Dependencies

Configured schedules initiate backup work. No RabbitMQ or other event-bus dependency is evidenced in the service source.

## Degraded Operation

If storage or a protected source is unavailable, the run must retain failure evidence rather than report success. Restore verification remains required before operational protection is considered successful.

## Validation

Validate focused backup, WAL-G, restore, and retention tests; inspect authenticated management access; and verify the health endpoint and IPS profile.
