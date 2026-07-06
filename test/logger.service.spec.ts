import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { of, throwError } from 'rxjs';
import { LoggerService, sanitizeMetadata } from '../shared/logger/logger.service';

describe('LoggerService', () => {
  const originalEnv = process.env;
  let logDir: string;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backups-logger-'));
    process.env.LOG_DIR = logDir;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    fs.rmSync(logDir, { recursive: true, force: true });
  });

  function serviceWith(post: jest.Mock) {
    return new LoggerService({ post } as any);
  }

  it('redacts sensitive metadata keys and string values recursively', () => {
    expect(sanitizeMetadata({
      job_id: 'job-1',
      password: 'not-for-output',
      nested: {
        token: 'not-for-output',
        message: 'connection failed password=not-for-output',
      },
    })).toEqual({
      job_id: 'job-1',
      password: '[redacted]',
      nested: {
        token: '[redacted]',
        message: 'connection failed password=[redacted]',
      },
    });
  });

  it('sends structured operation payloads to the logging service', async () => {
    process.env.LOGGING_SERVICE_URL = 'http://logging';
    process.env.LOGGING_SERVICE_API_PATH = '/api/logs';
    const post = jest.fn().mockReturnValue(of({ data: { ok: true } }));
    const logger = serviceWith(post);

    logger.operation({
      event: 'backup.run.started',
      message: 'Starting backup',
      context: 'BackupService',
      metadata: { job_id: 'job-1', token: 'not-for-output', duration_ms: 42, correlation_id: 'corr-1' },
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(post).toHaveBeenCalledWith(
      'http://logging/api/logs',
      expect.objectContaining({
        level: 'info',
        msg: 'Starting backup',
        service: 'backups-microservice',
        duration_ms: 42,
        correlation_id: 'corr-1',
        metadata: expect.objectContaining({
          event: 'backup.run.started',
          context: 'BackupService',
          job_id: 'job-1',
          token: '[redacted]',
        }),
      }),
      { timeout: 5000, headers: { 'Content-Type': 'application/json' } },
    );
  });

  it('writes redacted operation logs locally when remote logging is disabled', () => {
    delete process.env.LOGGING_SERVICE_URL;
    const post = jest.fn();
    const logger = serviceWith(post);

    logger.operation({
      event: 'restore.request.failed',
      level: 'error',
      message: 'Restore failed password=not-for-output',
      context: 'RestoreService',
      metadata: { request_id: 'restore-1', secret_ref: 'not-for-output' },
    });

    expect(post).not.toHaveBeenCalled();
    const contents = fs.readFileSync(path.join(logDir, 'error.log'), 'utf8');
    expect(contents).toContain('event=restore.request.failed');
    expect(contents).toContain('password=[redacted]');
    expect(contents).toContain('"secret_ref":"[redacted]"');
    expect(contents).not.toContain('not-for-output');
  });

  it('swallows remote logging failures', async () => {
    process.env.LOGGING_SERVICE_URL = 'http://logging';
    const post = jest.fn().mockReturnValue(throwError(() => new Error('network unavailable')));
    const logger = serviceWith(post);

    expect(() => logger.operation({
      event: 'retention.cleanup.failed',
      level: 'warn',
      message: 'Retention cleanup failed',
      context: 'RetentionService',
      metadata: { job_id: 'job-1' },
    })).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
  });
});
