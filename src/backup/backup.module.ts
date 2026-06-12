import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupRun } from './entities/backup-run.entity';
import { BackupJob } from '../jobs/entities/backup-job.entity';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { WalgModule } from './walg.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoggerModule } from '../../shared/logger/logger.module';
import { RetentionModule } from '../retention/retention.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BackupRun, BackupJob]),
    WalgModule,
    JobsModule,
    NotificationsModule,
    LoggerModule,
    forwardRef(() => RetentionModule),
  ],
  providers: [BackupService],
  controllers: [BackupController],
  exports: [BackupService],
})
export class BackupModule {}
