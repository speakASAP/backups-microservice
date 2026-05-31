import { WalgWrapperService } from '../src/backup/walg-wrapper.service';

const mockLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } as any;

describe('WalgWrapperService', () => {
  let service: WalgWrapperService;

  beforeEach(() => { service = new WalgWrapperService(mockLogger); });

  it('buildEnv constructs correct S3 prefix from storage_prefix', () => {
    const env = service.buildEnv(
      { storage_prefix: 's3://backups/mydb' },
      { host: 'db-server-postgres', port: 5432, database_name: 'mydb' },
      'secret',
    );
    expect(env.WALG_S3_PREFIX).toBe('s3://backups/mydb');
    expect(env.PGHOST).toBe('db-server-postgres');
    expect(env.PGDATABASE).toBe('mydb');
    expect(env.PGPASSWORD).toBe('secret');
    expect(env.AWS_S3_FORCE_PATH_STYLE).toBe('true');
  });

  it('buildEnv falls back to database_name when no storage_prefix', () => {
    process.env.WALG_S3_PREFIX = 's3://backups';
    const env = service.buildEnv(
      {},
      { host: 'localhost', port: 5432, database_name: 'notifications' },
      'pw',
    );
    expect(env.WALG_S3_PREFIX).toBe('s3://backups/notifications');
  });
});
