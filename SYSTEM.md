# SYSTEM.md — backups-microservice

## Service Identity

| Property | Value |
|----------|-------|
| Name | backups-microservice |
| Port | 3398 |
| Domain | backups.alfares.cz |
| Namespace | statex-apps |
| Type | infra |
| Stack | NestJS, TypeScript, PostgreSQL |

## Deployment

```bash
./scripts/deploy.sh
/home/ssf/Documents/Github/shared/scripts/wait-for-rollout.sh -n statex-apps backups-microservice
kubectl logs -f deploy/backups-microservice -n statex-apps
```

## Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| PORT | ConfigMap | Listen port (3398) |
| DB_HOST | ConfigMap | PostgreSQL host |
| DB_PASSWORD | Vault/ESO | Database password |
| JWT_SECRET | Vault/ESO | JWT validation |
| MINIO_ACCESS_KEY | Vault/ESO | MinIO credentials |
| MINIO_SECRET_KEY | Vault/ESO | MinIO credentials |
| MINIO_BACKUP_BUCKET | ConfigMap | Bucket name |
| BACKUP_SCHEDULE_DB | ConfigMap | Cron for DB backups |
| BACKUP_RETENTION_DAYS | ConfigMap | Retention period |

## Health

```
GET /health → 200 { status: "ok" }
```

## Database Schema

PostgreSQL schema: `backups`
Tables: `backup_jobs`, `backup_runs`, `restore_jobs`
Migrations run manually — `synchronize: false`
