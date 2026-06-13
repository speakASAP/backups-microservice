import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getDatabaseSchema, qualifyTable, quoteIdentifier } from '../config/database';

export const SCHEMA_READINESS_TABLES = [
  'backup_targets',
  'backup_jobs',
  'backup_runs',
  'restore_requests',
  'backup_destinations',
  'audit_events',
] as const;

function buildLegacyMoveSql(schema: string): string {
  if (schema === 'public') return '';

  return SCHEMA_READINESS_TABLES.map((table) => `
DO $$
BEGIN
  IF to_regclass('${schema}.${table}') IS NULL AND to_regclass('public.${table}') IS NOT NULL THEN
    ALTER TABLE public.${quoteIdentifier(table)} SET SCHEMA ${quoteIdentifier(schema)};
  END IF;
END $$;`).join('\n');
}

export function buildSchemaReadinessSql(schema = getDatabaseSchema()): string {
  const backupRuns = qualifyTable(schema, 'backup_runs');
  const backupTargets = qualifyTable(schema, 'backup_targets');
  const backupJobs = qualifyTable(schema, 'backup_jobs');
  const restoreRequests = qualifyTable(schema, 'restore_requests');
  const auditEvents = qualifyTable(schema, 'audit_events');

  return `
BEGIN;
CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema)};
${buildLegacyMoveSql(schema)}
ALTER TABLE ${backupRuns} ADD COLUMN IF NOT EXISTS verification_status varchar(20) DEFAULT 'unknown';
ALTER TABLE ${backupRuns} ADD COLUMN IF NOT EXISTS verification_checked_at timestamptz;
ALTER TABLE ${backupRuns} ADD COLUMN IF NOT EXISTS verification_reason varchar(255);
ALTER TABLE ${backupRuns} ADD COLUMN IF NOT EXISTS verification_error text;
ALTER TABLE ${backupTargets} ADD COLUMN IF NOT EXISTS service_owner varchar(120);
ALTER TABLE ${backupTargets} ADD COLUMN IF NOT EXISTS source_category varchar(40) DEFAULT 'postgres_database';
ALTER TABLE ${backupTargets} ADD COLUMN IF NOT EXISTS criticality varchar(20) DEFAULT 'standard';
ALTER TABLE ${backupTargets} ADD COLUMN IF NOT EXISTS rpo_minutes int;
ALTER TABLE ${backupTargets} ADD COLUMN IF NOT EXISTS rto_minutes int;
ALTER TABLE ${backupTargets} ADD COLUMN IF NOT EXISTS restore_class varchar(40) DEFAULT 'logical_postgres';
ALTER TABLE ${backupTargets} ADD COLUMN IF NOT EXISTS kubernetes_namespace varchar(80);
ALTER TABLE ${backupTargets} ADD COLUMN IF NOT EXISTS coverage_notes text;
ALTER TABLE ${backupJobs} ADD COLUMN IF NOT EXISTS schedule_policy varchar(20) DEFAULT 'custom_cron';
ALTER TABLE ${backupJobs} ADD COLUMN IF NOT EXISTS schedule_hour_utc int;
ALTER TABLE ${backupJobs} ADD COLUMN IF NOT EXISTS schedule_minute_utc int;
ALTER TABLE ${backupJobs} ADD COLUMN IF NOT EXISTS schedule_day_of_week int;
ALTER TABLE ${backupJobs} ADD COLUMN IF NOT EXISTS retention_approval_actor varchar(255);
ALTER TABLE ${backupJobs} ADD COLUMN IF NOT EXISTS retention_approval_reason text;
ALTER TABLE ${backupJobs} ADD COLUMN IF NOT EXISTS retention_approved_at timestamptz;
ALTER TABLE ${restoreRequests} ADD COLUMN IF NOT EXISTS approval_actor varchar(255);
ALTER TABLE ${restoreRequests} ADD COLUMN IF NOT EXISTS approval_reason text;
ALTER TABLE ${restoreRequests} ADD COLUMN IF NOT EXISTS approval_confirmed_target_id uuid;
ALTER TABLE ${restoreRequests} ADD COLUMN IF NOT EXISTS approval_confirmed_backup_run_id uuid;
ALTER TABLE ${restoreRequests} ADD COLUMN IF NOT EXISTS production_restore_approved boolean DEFAULT false;
ALTER TABLE ${restoreRequests} ADD COLUMN IF NOT EXISTS approved_at timestamptz;
CREATE TABLE IF NOT EXISTS ${auditEvents} (
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
}

export const SCHEMA_READINESS_SQL = buildSchemaReadinessSql('backups');

@Injectable()
export class SchemaReadinessService {
  private readonly logger = new Logger(SchemaReadinessService.name);

  constructor(private readonly dataSource: DataSource) {}

  async apply(): Promise<void> {
    if (process.env.BACKUPS_APPLY_SCHEMA_READINESS === 'false') {
      this.logger.warn('Schema readiness alignment skipped by BACKUPS_APPLY_SCHEMA_READINESS=false');
      return;
    }

    const schema = getDatabaseSchema();
    await this.dataSource.query(buildSchemaReadinessSql(schema));
    this.logger.log(`Schema readiness alignment complete for schema ${schema}`);
  }
}
