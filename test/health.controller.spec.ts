import { HealthController } from '../src/health/health.controller';

describe('HealthController', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WALG_S3_PREFIX: 's3://backups',
      WALG_S3_ENDPOINT: 'http://minio:9000',
      MINIO_BUCKET: 'backups',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('reports database and storage readiness separately', async () => {
    const dataSource = { isInitialized: true, query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as any;
    const controller = new HealthController(dataSource);

    const result = await controller.readiness({ status: jest.fn() } as any);

    expect(result.success).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.checks.database.status).toBe('ready');
    expect(result.checks.storage.status).toBe('ready');
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('marks readiness unavailable when the database is not initialized', async () => {
    const response = { status: jest.fn() } as any;
    const dataSource = { isInitialized: false, query: jest.fn() } as any;
    const controller = new HealthController(dataSource);

    const result = await controller.readiness(response);

    expect(result.success).toBe(false);
    expect(result.status).toBe('degraded');
    expect(result.checks.database.status).toBe('not_ready');
    expect(response.status).toHaveBeenCalledWith(503);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('marks storage not ready without safe WAL-G storage configuration', async () => {
    process.env.WALG_S3_PREFIX = '';
    process.env.WALG_S3_ENDPOINT = '';
    process.env.MINIO_ENDPOINT = '';
    process.env.MINIO_SERVICE_URL = '';
    process.env.MINIO_BUCKET = '';
    process.env.MINIO_BACKUP_BUCKET = '';
    const response = { status: jest.fn() } as any;
    const dataSource = { isInitialized: true, query: jest.fn().mockResolvedValue([]) } as any;
    const controller = new HealthController(dataSource);

    const result = await controller.readiness(response);

    expect(result.success).toBe(false);
    expect(result.checks.storage.status).toBe('not_ready');
    expect(result.checks.storage.details).toEqual(expect.objectContaining({
      prefix_configured: false,
      endpoint_configured: false,
      bucket_configured: false,
    }));
    expect(response.status).toHaveBeenCalledWith(503);
  });
});
