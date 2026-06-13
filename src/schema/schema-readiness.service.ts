import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export const SCHEMA_READINESS_SQL = `
BEGIN;
ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS verification_status varchar(20) DEFAULT 'unknown';
ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS verification_checked_at timestamptz;
ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS verification_reason varchar(255);
ALTER TABLE backup_runs ADD COLUMN IF NOT EXISTS verification_error text;
ALTER TABLE backup_targets ADD COLUMN IF NOT EXISTS service_owner varchar(120);
ALTER TABLE backup_targets ADD COLUMN IF NOT EXISTS source_category varchar(40) DEFAULT 'postgres_database';
ALTER TABLE backup_targets ADD COLUMN IF NOT EXISTS criticality varchar(20) DEFAULT 'standard';
ALTER TABLE backup_targets ADD COLUMN IF NOT EXISTS rpo_minutes int;
ALTER TABLE backup_targets ADD COLUMN IF NOT EXISTS rto_minutes int;
ALTER TABLE backup_targets ADD COLUMN IF NOT EXISTS restore_class varchar(40) DEFAULT 'logical_postgres';
ALTER TABLE backup_targets ADD COLUMN IF NOT EXISTS kubernetes_namespace varchar(80);
ALTER TABLE backup_targets ADD COLUMN IF NOT EXISTS coverage_notes text;
ALTER TABLE backup_jobs ADD COLUMN IF NOT EXISTS retention_approval_actor varchar(255);
ALTER TABLE backup_jobs ADD COLUMN IF NOT EXISTS retention_approval_reason text;
ALTER TABLE backup_jobs ADD COLUMN IF NOT EXISTS retention_approved_at timestamptz;
ALTER TABLE restore_requests ADD COLUMN IF NOT EXISTS approval_actor varchar(255);
ALTER TABLE restore_requests ADD COLUMN IF NOT EXISTS approval_reason text;
ALTER TABLE restore_requests ADD COLUMN IF NOT EXISTS approval_confirmed_target_id uuid;
ALTER TABLE restore_requests ADD COLUMN IF NOT EXISTS approval_confirmed_backup_run_id uuid;
ALTER TABLE restore_requests ADD COLUMN IF NOT EXISTS production_restore_approved boolean DEFAULT false;
ALTER TABLE restore_requests ADD COLUMN IF NOT EXISTS approved_at timestamptz;
CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action varchar(80) NOT NULL,
  actor varchar(255) NOT NULL,
  target_id uuid,
  job_id uuid,
  backup_run_id uuid,
  restore_request_id uuid,
  reason text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT NOW()
);
COMMIT;
`;

@Injectable()
export class SchemaReadinessService {
  private readonly logger = new Logger(SchemaReadinessService.name);

  constructor(private readonly dataSource: DataSource) {}

  async apply(): Promise<void> {
    if (process.env.BACKUPS_APPLY_SCHEMA_READINESS === 'false') {
      this.logger.warn('Schema readiness alignment skipped by BACKUPS_APPLY_SCHEMA_READINESS=false');
      return;
    }

    await this.dataSource.query(SCHEMA_READINESS_SQL);
    this.logger.log('Schema readiness alignment complete');
  }
}
