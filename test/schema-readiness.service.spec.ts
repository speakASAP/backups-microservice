import { ServiceUnavailableException } from '@nestjs/common';
import {
  buildRestoreSerializationCheckSql,
  buildSchemaReadinessSql,
  SCHEMA_READINESS_SQL,
  SchemaReadinessService,
} from '../src/schema/schema-readiness.service';
import { RESTORE_ACTIVE_TARGET_INDEX } from '../src/restore/restore-constraints';

/** Data source double whose serialization check reports a configurable outcome. */
function dataSourceWith(check: { installed: boolean; duplicate_targets: number } | Error) {
  return {
    query: jest.fn(async (sql: string) => {
      if (!sql.includes('pg_class')) return undefined;
      if (check instanceof Error) throw check;
      return [check];
    }),
  } as any;
}

describe('SchemaReadinessService', () => {
  const originalSkip = process.env.BACKUPS_APPLY_SCHEMA_READINESS;
  const originalSchema = process.env.DB_SCHEMA;

  afterEach(() => {
    if (originalSkip === undefined) delete process.env.BACKUPS_APPLY_SCHEMA_READINESS;
    else process.env.BACKUPS_APPLY_SCHEMA_READINESS = originalSkip;
    if (originalSchema === undefined) delete process.env.DB_SCHEMA;
    else process.env.DB_SCHEMA = originalSchema;
  });

  it('uses only additive idempotent schema operations', () => {
    expect(SCHEMA_READINESS_SQL).toContain('CREATE SCHEMA IF NOT EXISTS "backups"');
    expect(SCHEMA_READINESS_SQL).toContain('ADD COLUMN IF NOT EXISTS');
    expect(SCHEMA_READINESS_SQL).toContain('CREATE TABLE IF NOT EXISTS "backups"."audit_events"');
    expect(SCHEMA_READINESS_SQL).not.toMatch(/\b(drop|truncate|delete)\b/i);
  });

  it('adds database-enforced restore serialization controls idempotently', () => {
    const sql = buildSchemaReadinessSql('backups');

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS idempotency_key varchar(200)');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "uq_restore_requests_idempotency_key"');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "uq_restore_requests_active_target"');
    expect(sql).toContain("WHERE status IN ('pending', 'running')");
  });

  it('moves legacy public tables into the configured backups schema without copying data', () => {
    const sql = buildSchemaReadinessSql('backups');

    expect(sql).toContain('ALTER TABLE public."backup_targets" SET SCHEMA "backups"');
    expect(sql).toContain("to_regclass('backups.backup_targets') IS NULL");
    expect(sql).toContain("to_regclass('public.backup_targets') IS NOT NULL");
  });

  it('does not emit legacy table moves for public schema', () => {
    const sql = buildSchemaReadinessSql('public');

    expect(sql).toContain('CREATE SCHEMA IF NOT EXISTS "public"');
    expect(sql).not.toContain('SET SCHEMA');
  });

  it('applies schema readiness SQL through the configured data source', async () => {
    process.env.DB_SCHEMA = 'backups';
    const dataSource = dataSourceWith({ installed: true, duplicate_targets: 0 });
    const service = new SchemaReadinessService(dataSource);

    await service.apply();

    expect(dataSource.query).toHaveBeenCalledWith(buildSchemaReadinessSql('backups'));
  });

  it('can be disabled for emergency operations without skipping the serialization proof', async () => {
    process.env.BACKUPS_APPLY_SCHEMA_READINESS = 'false';
    process.env.DB_SCHEMA = 'backups';
    const dataSource = dataSourceWith({ installed: true, duplicate_targets: 0 });
    const service = new SchemaReadinessService(dataSource);

    await service.apply();

    expect(dataSource.query).not.toHaveBeenCalledWith(buildSchemaReadinessSql('backups'));
    expect(dataSource.query).toHaveBeenCalledWith(
      buildRestoreSerializationCheckSql('backups'),
      ['backups', RESTORE_ACTIVE_TARGET_INDEX],
    );
    expect(service.getRestoreSerializationState().ready).toBe(true);
  });
});

describe('SchemaReadinessService restore serialization gate', () => {
  const originalSchema = process.env.DB_SCHEMA;
  const originalStrict = process.env.BACKUPS_FAIL_START_WITHOUT_RESTORE_SERIALIZATION;

  beforeEach(() => {
    process.env.DB_SCHEMA = 'backups';
    delete process.env.BACKUPS_FAIL_START_WITHOUT_RESTORE_SERIALIZATION;
  });

  afterEach(() => {
    if (originalSchema === undefined) delete process.env.DB_SCHEMA;
    else process.env.DB_SCHEMA = originalSchema;
    if (originalStrict === undefined) delete process.env.BACKUPS_FAIL_START_WITHOUT_RESTORE_SERIALIZATION;
    else process.env.BACKUPS_FAIL_START_WITHOUT_RESTORE_SERIALIZATION = originalStrict;
  });

  it('refuses restores before the serialization proof has ever run', () => {
    const service = new SchemaReadinessService(dataSourceWith({ installed: true, duplicate_targets: 0 }));

    expect(service.getRestoreSerializationState().ready).toBe(false);
    expect(() => service.assertRestoreSerializationReady()).toThrow(ServiceUnavailableException);
  });

  it('accepts restores once the active-target unique index is proven installed', async () => {
    const service = new SchemaReadinessService(dataSourceWith({ installed: true, duplicate_targets: 0 }));

    await service.apply();

    const state = service.getRestoreSerializationState();
    expect(state.ready).toBe(true);
    expect(state.reason).toContain(RESTORE_ACTIVE_TARGET_INDEX);
    expect(state.checked_at).not.toBeNull();
    expect(() => service.assertRestoreSerializationReady()).not.toThrow();
  });

  it('fails closed when duplicates prevented the index from being installed', async () => {
    const service = new SchemaReadinessService(dataSourceWith({ installed: false, duplicate_targets: 2 }));

    await service.apply();

    const state = service.getRestoreSerializationState();
    expect(state.ready).toBe(false);
    expect(state.duplicate_targets).toBe(2);
    expect(state.reason).toContain('2 target(s)');
    expect(() => service.assertRestoreSerializationReady()).toThrow(ServiceUnavailableException);
  });

  it('fails closed when the index is simply missing', async () => {
    const service = new SchemaReadinessService(dataSourceWith({ installed: false, duplicate_targets: 0 }));

    await service.apply();

    expect(service.getRestoreSerializationState().ready).toBe(false);
    expect(() => service.assertRestoreSerializationReady()).toThrow(ServiceUnavailableException);
  });

  it('fails closed when the serialization proof itself cannot run', async () => {
    const service = new SchemaReadinessService(dataSourceWith(new Error('relation does not exist')));

    await service.apply();

    const state = service.getRestoreSerializationState();
    expect(state.ready).toBe(false);
    expect(state.reason).toContain('relation does not exist');
  });

  it('can be configured to refuse startup instead of running degraded', async () => {
    process.env.BACKUPS_FAIL_START_WITHOUT_RESTORE_SERIALIZATION = 'true';
    const service = new SchemaReadinessService(dataSourceWith({ installed: false, duplicate_targets: 1 }));

    await expect(service.apply()).rejects.toThrow('Refusing to start without database-enforced restore serialization');
  });

  it('starts when serialization is proven even under the strict startup policy', async () => {
    process.env.BACKUPS_FAIL_START_WITHOUT_RESTORE_SERIALIZATION = 'true';
    const service = new SchemaReadinessService(dataSourceWith({ installed: true, duplicate_targets: 0 }));

    await expect(service.apply()).resolves.toBeUndefined();
  });

  it('checks the index by name in the configured schema', () => {
    const sql = buildRestoreSerializationCheckSql('backups');

    expect(sql).toContain('pg_class');
    expect(sql).toContain("i.relkind = 'i'");
    expect(sql).toContain('"backups"."restore_requests"');
    expect(sql).toContain("WHERE status IN ('pending', 'running')");
  });
});
