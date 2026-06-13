import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { LoggerService } from '../../shared/logger/logger.service';

export const BACKUP_NOTIFICATION_EVENTS = {
  BACKUP_SUCCESS: 'backup.success',
  BACKUP_FAILURE: 'backup.failure',
  BACKUP_VERIFICATION_PENDING: 'backup.verification.pending',
  BACKUP_VERIFICATION_VERIFIED: 'backup.verification.verified',
  BACKUP_VERIFICATION_FAILED: 'backup.verification.failed',
  RESTORE_COMPLETED: 'restore.completed',
  RESTORE_FAILED: 'restore.failed',
  RETENTION_CLEANUP_SUCCESS: 'retention.cleanup.success',
  RETENTION_CLEANUP_FAILURE: 'retention.cleanup.failure',
} as const;

export type BackupNotificationEvent =
  (typeof BACKUP_NOTIFICATION_EVENTS)[keyof typeof BACKUP_NOTIFICATION_EVENTS];

export interface NotificationPayload {
  event: BackupNotificationEvent | string;
  message: string;
  service: string;
  details?: Record<string, unknown>;
}

export interface BackupRunNotificationDetails extends Record<string, unknown> {
  job_id: string;
  run_id: string;
  duration_sec?: number;
  verification_status?: string;
  reason?: string;
  error?: string;
}

export interface RestoreNotificationDetails extends Record<string, unknown> {
  request_id: string;
  backup_run_id?: string;
  error?: string;
}

export interface RetentionNotificationDetails extends Record<string, unknown> {
  job_id: string;
  retain_count: number;
  error?: string;
}

const SENSITIVE_KEY_PATTERN = /(authorization|token|password|secret|access[_-]?key|private[_-]?key|credential|vault)/i;
const REDACTED = '[redacted]';

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (value && typeof value === 'object') {
    return sanitizeDetails(value as Record<string, unknown>);
  }
  return value;
}

export function sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!details) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (value === undefined) continue;
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeValue(value);
  }
  return sanitized;
}

@Injectable()
export class NotificationsService {
  private readonly url: string;
  private readonly token: string;

  constructor(private httpService: HttpService, private logger: LoggerService) {
    this.url = process.env.NOTIFICATIONS_SERVICE_URL || process.env.NOTIFICATION_SERVICE_URL || '';
    this.token = process.env.NOTIFICATIONS_SERVICE_TOKEN || process.env.NOTIFICATION_SERVICE_TOKEN || '';
  }

  async send(event: BackupNotificationEvent | string, message: string, details?: Record<string, unknown>): Promise<void> {
    if (!this.url || !this.token) return;

    const payload: NotificationPayload = {
      event,
      message,
      service: 'backups-microservice',
      details: sanitizeDetails(details),
    };

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.url}/notify`,
          payload,
          { headers: { Authorization: `Bearer ${this.token}` }, timeout: 5000 },
        ),
      );
    } catch (err) {
      this.logger.warn(`Failed to send notification event=${event}: ${err}`, 'NotificationsService');
    }
  }

  backupSucceeded(jobName: string, details: BackupRunNotificationDetails): Promise<void> {
    return this.send(BACKUP_NOTIFICATION_EVENTS.BACKUP_SUCCESS, `Backup successful: ${jobName}`, details);
  }

  backupFailed(jobName: string, details: BackupRunNotificationDetails): Promise<void> {
    return this.send(BACKUP_NOTIFICATION_EVENTS.BACKUP_FAILURE, `Backup FAILED: ${jobName}`, details);
  }

  verificationPending(jobName: string, details: BackupRunNotificationDetails): Promise<void> {
    return this.send(BACKUP_NOTIFICATION_EVENTS.BACKUP_VERIFICATION_PENDING, `Restore verification pending: ${jobName}`, details);
  }

  verificationVerified(targetName: string, details: RestoreNotificationDetails): Promise<void> {
    return this.send(BACKUP_NOTIFICATION_EVENTS.BACKUP_VERIFICATION_VERIFIED, `Restore verification passed for target: ${targetName}`, details);
  }

  verificationFailed(targetName: string, details: RestoreNotificationDetails): Promise<void> {
    return this.send(BACKUP_NOTIFICATION_EVENTS.BACKUP_VERIFICATION_FAILED, `Restore verification FAILED for target: ${targetName}`, details);
  }

  restoreCompleted(targetName: string, details: RestoreNotificationDetails): Promise<void> {
    return this.send(BACKUP_NOTIFICATION_EVENTS.RESTORE_COMPLETED, `Restore completed for target: ${targetName}`, details);
  }

  restoreFailed(targetName: string, details: RestoreNotificationDetails): Promise<void> {
    return this.send(BACKUP_NOTIFICATION_EVENTS.RESTORE_FAILED, `Restore FAILED for target: ${targetName}`, details);
  }

  retentionCleanupSucceeded(jobName: string, details: RetentionNotificationDetails): Promise<void> {
    return this.send(BACKUP_NOTIFICATION_EVENTS.RETENTION_CLEANUP_SUCCESS, `Retention cleanup done for job: ${jobName}`, details);
  }

  retentionCleanupFailed(jobName: string, details: RetentionNotificationDetails): Promise<void> {
    return this.send(BACKUP_NOTIFICATION_EVENTS.RETENTION_CLEANUP_FAILURE, `Retention cleanup FAILED for job: ${jobName}`, details);
  }
}
