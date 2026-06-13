import { SCHEMA_READINESS_SQL, SchemaReadinessService } from '../src/schema/schema-readiness.service';

describe('SchemaReadinessService', () => {
  const originalSkip = process.env.BACKUPS_APPLY_SCHEMA_READINESS;

  afterEach(() => {
    if (originalSkip === undefined) delete process.env.BACKUPS_APPLY_SCHEMA_READINESS;
    else process.env.BACKUPS_APPLY_SCHEMA_READINESS = originalSkip;
  });

  it('uses only additive idempotent schema operations', () => {
    expect(SCHEMA_READINESS_SQL).toContain('ADD COLUMN IF NOT EXISTS');
    expect(SCHEMA_READINESS_SQL).toContain('CREATE TABLE IF NOT EXISTS audit_events');
    expect(SCHEMA_READINESS_SQL).not.toMatch(/\b(drop|truncate|delete)\b/i);
  });

  it('applies schema readiness SQL through the configured data source', async () => {
    const dataSource = { query: jest.fn(async () => undefined) };
    const service = new SchemaReadinessService(dataSource as any);

    await service.apply();

    expect(dataSource.query).toHaveBeenCalledWith(SCHEMA_READINESS_SQL);
  });

  it('can be disabled for emergency operations', async () => {
    process.env.BACKUPS_APPLY_SCHEMA_READINESS = 'false';
    const dataSource = { query: jest.fn(async () => undefined) };
    const service = new SchemaReadinessService(dataSource as any);

    await service.apply();

    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
