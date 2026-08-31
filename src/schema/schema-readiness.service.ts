import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getDatabaseSchema, qualifyTable, quoteIdentifier } from '../config/database';
import {
  RESTORE_ACTIVE_TARGET_INDEX,
  RESTORE_IDEMPOTENCY_INDEX,
} from '../restore/restore-constraints';

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
ALTER TABLE ${restoreRequests} ADD COLUMN IF NOT EXISTS idempotency_key varchar(200);
CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdentifier(RESTORE_IDEMPOTENCY_INDEX)} ON ${restoreRequests} (idempotency_key) WHERE idempotency_key IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ${restoreRequests}
    WHERE status IN ('pending', 'running')
    GROUP BY target_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdentifier(RESTORE_ACTIVE_TARGET_INDEX)} ON ${restoreRequests} (target_id) WHERE status IN ('pending', 'running');
  ELSE
    RAISE WARNING 'restore_requests already holds more than one active request per target; per-target serialization index was not created';
  END IF;
END $$;
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

/**
 * Reads whether the per-target restore serialization index actually exists, and
 * how many targets currently hold more than one active request. The additive
 * readiness path can only create the index when the catalog is already clean, so
 * its presence - not the fact that the statement ran - is the only proof that
 * concurrent destructive restores are impossible.
 */
export function buildRestoreSerializationCheckSql(schema = getDatabaseSchema()): string {
  const restoreRequests = qualifyTable(schema, 'restore_requests');

  return `
SELECT
  EXISTS (
    SELECT 1
    FROM pg_class i
    JOIN pg_namespace n ON n.oid = i.relnamespace
    WHERE i.relkind = 'i' AND i.relname = $2 AND n.nspname = $1
  ) AS installed,
  (
    SELECT count(*) FROM (
      SELECT target_id
      FROM ${restoreRequests}
      WHERE status IN ('pending', 'running')
      GROUP BY target_id
      HAVING count(*) > 1
    ) duplicates
  ) AS duplicate_targets
`;
}

export interface RestoreSerializationState {
  ready: boolean;
  reason: string;
  checked_at: string | null;
  duplicate_targets: number | null;
}

export const SCHEMA_READINESS_SQL = buildSchemaReadinessSql('backups');

@Injectable()
export class SchemaReadinessService {
  private readonly logger = new Logger(SchemaReadinessService.name);

  /**
   * Starts unready on purpose. Until the index has been observed, the service has
   * no evidence that two approved restores cannot run against one target at once,
   * and a destructive restore must never be accepted on an assumption.
   */
  private restoreSerialization: RestoreSerializationState = {
    ready: false,
    reason: 'Restore serialization has not been verified yet.',
    checked_at: null,
    duplicate_targets: null,
  };

  constructor(private readonly dataSource: DataSource) {}

  getRestoreSerializationState(): RestoreSerializationState {
    return { ...this.restoreSerialization };
  }

  /**
   * Fail-closed gate for destructive restore traffic. Without the unique index the
   * database cannot serialize restores for a target, so requests are refused with
   * 503 instead of being accepted into an unserialized queue.
   */
  assertRestoreSerializationReady(): void {
    if (this.restoreSerialization.ready) return;
    throw new ServiceUnavailableException(
      `Restore requests are unavailable: ${this.restoreSerialization.reason}`,
    );
  }

  async apply(): Promise<void> {
    const schema = getDatabaseSchema();

    if (process.env.BACKUPS_APPLY_SCHEMA_READINESS === 'false') {
      this.logger.warn('Schema readiness alignment skipped by BACKUPS_APPLY_SCHEMA_READINESS=false');
    } else {
      await this.dataSource.query(buildSchemaReadinessSql(schema));
      this.logger.log(`Schema readiness alignment complete for schema ${schema}`);
    }

    await this.verifyRestoreSerialization(schema);
  }

  private async verifyRestoreSerialization(schema: string): Promise<void> {
    const checkedAt = new Date().toISOString();

    try {
      const rows = await this.dataSource.query(buildRestoreSerializationCheckSql(schema), [
        schema,
        RESTORE_ACTIVE_TARGET_INDEX,
      ]);
      const row = Array.isArray(rows) ? rows[0] : undefined;
      const installed = row?.installed === true || row?.installed === 't' || row?.installed === 1;
      const duplicates = Number(row?.duplicate_targets ?? 0);

      this.restoreSerialization = installed
        ? {
          ready: true,
          reason: `${RESTORE_ACTIVE_TARGET_INDEX} is installed and enforcing one active restore per target.`,
          checked_at: checkedAt,
          duplicate_targets: Number.isFinite(duplicates) ? duplicates : 0,
        }
        : {
          ready: false,
          reason: Number.isFinite(duplicates) && duplicates > 0
            ? `${RESTORE_ACTIVE_TARGET_INDEX} could not be installed because ${duplicates} target(s) already hold more than one active restore request.`
            : `${RESTORE_ACTIVE_TARGET_INDEX} is not installed, so restores cannot be serialized by the database.`,
          checked_at: checkedAt,
          duplicate_targets: Number.isFinite(duplicates) ? duplicates : null,
        };
    } catch (error) {
      this.restoreSerialization = {
        ready: false,
        reason: `Restore serialization could not be verified: ${error instanceof Error ? error.message : 'unknown error'}`,
        checked_at: checkedAt,
        duplicate_targets: null,
      };
    }

    if (this.restoreSerialization.ready) {
      this.logger.log(this.restoreSerialization.reason);
      return;
    }

    this.logger.error(
      `Restore serialization is DEGRADED; restore requests will be refused with 503. ${this.restoreSerialization.reason}`,
    );

    if (process.env.BACKUPS_FAIL_START_WITHOUT_RESTORE_SERIALIZATION === 'true') {
      throw new Error(
        `Refusing to start without database-enforced restore serialization. ${this.restoreSerialization.reason}`,
      );
    }
  }
}
