import {
  buildSchemaReadinessSql,
  SCHEMA_READINESS_SQL,
  SchemaReadinessService,
} from '../src/schema/schema-readiness.service';

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
    const dataSource = { query: jest.fn(async () => undefined) };
    const service = new SchemaReadinessService(dataSource as any);

    await service.apply();

    expect(dataSource.query).toHaveBeenCalledWith(buildSchemaReadinessSql('backups'));
  });

  it('can be disabled for emergency operations', async () => {
    process.env.BACKUPS_APPLY_SCHEMA_READINESS = 'false';
    const dataSource = { query: jest.fn(async () => undefined) };
    const service = new SchemaReadinessService(dataSource as any);

    await service.apply();

    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
