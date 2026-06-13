import { defaultNightlyConfig, NightlyBackupBootstrapService } from '../src/backup/nightly-backup-bootstrap.service';
import { RestoreClass, SourceCategory, TargetCriticality, TargetType } from '../src/targets/entities/backup-target.entity';

describe('NightlyBackupBootstrapService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('builds a default nightly PostgreSQL config from environment', () => {
    process.env.DB_HOST = 'postgres.internal';
    process.env.DB_PORT = '5433';
    process.env.DB_NAME = 'statex';
    process.env.BACKUP_SCHEDULE_DB = '15 2 * * *';
    process.env.WALG_S3_PREFIX = 's3://backups/statex';

    expect(defaultNightlyConfig()).toEqual(expect.objectContaining({
      enabled: true,
      host: 'postgres.internal',
      port: 5433,
      databaseName: 'statex',
      scheduleCron: '15 2 * * *',
      storagePrefix: 's3://backups/statex/statex',
    }));
  });

  it('creates a target and nightly job without exposing credentials', async () => {
    process.env.DB_HOST = 'db-server-postgres';
    process.env.DB_NAME = 'backups';
    const targetRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn(() => ({})),
      save: jest.fn(async (value) => ({ ...value, id: value.id || 'target-1' })),
    };
    const jobRepo = {
      findOne: jest.fn(async () => null),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: value.id || 'job-1' })),
    };
    const service = new NightlyBackupBootstrapService(targetRepo as any, jobRepo as any);

    await service.ensureDefaultNightlyJob();

    expect(targetRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      type: TargetType.POSTGRES,
      host: 'db-server-postgres',
      database_name: 'backups',
      source_category: SourceCategory.POSTGRES_DATABASE,
      criticality: TargetCriticality.CRITICAL,
      restore_class: RestoreClass.LOGICAL_POSTGRES,
      enabled: true,
    }));
    expect(jobRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      target_id: 'target-1',
      schedule_cron: '0 2 * * *',
      retention_full_count: 7,
      enabled: true,
    }));
    expect(JSON.stringify(targetRepo.save.mock.calls)).not.toMatch(/password|secret_value|token/i);
  });

  it('does not create records when disabled', async () => {
    process.env.BACKUPS_DEFAULT_NIGHTLY_ENABLED = 'false';
    const targetRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const jobRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    const service = new NightlyBackupBootstrapService(targetRepo as any, jobRepo as any);

    await expect(service.ensureDefaultNightlyJob()).resolves.toBeNull();
    expect(targetRepo.save).not.toHaveBeenCalled();
    expect(jobRepo.save).not.toHaveBeenCalled();
  });
});
