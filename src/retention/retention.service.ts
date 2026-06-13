import { Injectable } from '@nestjs/common';
import { WalgWrapperService, WalgEnv } from '../backup/walg-wrapper.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoggerService } from '../../shared/logger/logger.service';
import { BackupJob } from '../jobs/entities/backup-job.entity';

@Injectable()
export class RetentionService {
  constructor(
    private walg: WalgWrapperService,
    private notifications: NotificationsService,
    private logger: LoggerService,
  ) {}

  async cleanup(job: BackupJob, env: WalgEnv): Promise<void> {
    this.logger.operation({
      event: 'retention.cleanup.started',
      message: 'Retention cleanup started',
      context: 'RetentionService',
      metadata: { job_id: job.id, retain_count: job.retention_full_count },
    });
    const result = await this.walg.deleteRetain(env, job.retention_full_count);
    if (result.exitCode === 0) {
      this.logger.operation({
        event: 'retention.cleanup.succeeded',
        message: 'Retention cleanup completed',
        context: 'RetentionService',
        metadata: { job_id: job.id, retain_count: job.retention_full_count },
      });
      await this.notifications.retentionCleanupSucceeded(job.name, {
        job_id: job.id,
        retain_count: job.retention_full_count,
      });
    } else {
      const error = result.output.slice(-500);
      this.logger.operation({
        event: 'retention.cleanup.failed',
        level: 'warn',
        message: 'Retention cleanup failed',
        context: 'RetentionService',
        metadata: { job_id: job.id, retain_count: job.retention_full_count, error },
      });
      await this.notifications.retentionCleanupFailed(job.name, {
        job_id: job.id,
        retain_count: job.retention_full_count,
        error,
      });
    }
  }
}
