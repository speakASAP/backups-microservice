import { of, throwError } from 'rxjs';
import {
  BACKUP_NOTIFICATION_EVENTS,
  NotificationsService,
  sanitizeDetails,
} from '../src/notifications/notifications.service';

describe('NotificationsService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  function serviceWith(post: jest.Mock) {
    const logger = { warn: jest.fn() };
    const service = new NotificationsService({ post } as any, logger as any);
    return { service, logger };
  }

  it('does not send when notifications are not configured', async () => {
    delete process.env.NOTIFICATION_SERVICE_URL;
    delete process.env.NOTIFICATIONS_SERVICE_URL;
    delete process.env.NOTIFICATION_SERVICE_TOKEN;
    delete process.env.NOTIFICATIONS_SERVICE_TOKEN;
    const post = jest.fn();
    const { service } = serviceWith(post);

    await service.backupSucceeded('nightly', { job_id: 'job-1', run_id: 'run-1' });

    expect(post).not.toHaveBeenCalled();
  });

  it('sends typed backup success notifications', async () => {
    process.env.NOTIFICATION_SERVICE_URL = 'http://notifications';
    process.env.NOTIFICATION_SERVICE_TOKEN = 'configured-token';
    const post = jest.fn().mockReturnValue(of({ data: { ok: true } }));
    const { service } = serviceWith(post);

    await service.backupSucceeded('nightly', { job_id: 'job-1', run_id: 'run-1', duration_sec: 42 });

    expect(post).toHaveBeenCalledWith(
      'http://notifications/notify',
      {
        event: BACKUP_NOTIFICATION_EVENTS.BACKUP_SUCCESS,
        message: 'Backup successful: nightly',
        service: 'backups-microservice',
        details: { job_id: 'job-1', run_id: 'run-1', duration_sec: 42 },
      },
      { headers: { Authorization: 'Bearer configured-token' }, timeout: 5000 },
    );
  });

  it('redacts sensitive detail keys recursively', () => {
    expect(sanitizeDetails({
      job_id: 'job-1',
      password: 'not-for-output',
      nested: {
        access_key: 'not-for-output',
        retain_count: 7,
      },
    })).toEqual({
      job_id: 'job-1',
      password: '[redacted]',
      nested: {
        access_key: '[redacted]',
        retain_count: 7,
      },
    });
  });

  it('swallows transport errors and logs warning', async () => {
    process.env.NOTIFICATION_SERVICE_URL = 'http://notifications';
    process.env.NOTIFICATION_SERVICE_TOKEN = 'configured-token';
    const post = jest.fn().mockReturnValue(throwError(() => new Error('network unavailable')));
    const { service, logger } = serviceWith(post);

    await expect(service.retentionCleanupFailed('nightly', {
      job_id: 'job-1',
      retain_count: 7,
      error: 'wal-g delete failed',
    })).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send notification event=retention.cleanup.failure'),
      'NotificationsService',
    );
  });
});
