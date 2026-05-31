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
    this.logger.log(`Running retention cleanup for job=${job.id} retain=${job.retention_full_count}`, 'RetentionService');
    const result = await this.walg.deleteRetain(env, job.retention_full_count);
    if (result.exitCode === 0) {
      this.logger.log(`Retention cleanup complete for job=${job.id}`, 'RetentionService');
      await this.notifications.send('retention.cleanup', `Retention cleanup done for job "${job.name}"`, {
        job_id: job.id,
        retain_count: job.retention_full_count,
      });
    } else {
      this.logger.warn(`Retention cleanup failed for job=${job.id}: ${result.output}`, 'RetentionService');
    }
  }
}
