import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupRun } from './entities/backup-run.entity';
import { BackupJob } from '../jobs/entities/backup-job.entity';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BackupTarget } from '../targets/entities/backup-target.entity';
import { NightlyBackupBootstrapService } from './nightly-backup-bootstrap.service';
import { WalgModule } from './walg.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoggerModule } from '../../shared/logger/logger.module';
import { RetentionModule } from '../retention/retention.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BackupRun, BackupJob, BackupTarget]),
    WalgModule,
    JobsModule,
    NotificationsModule,
    LoggerModule,
    AuditModule,
    forwardRef(() => RetentionModule),
  ],
  providers: [BackupService, NightlyBackupBootstrapService],
  controllers: [BackupController],
  exports: [BackupService],
})
export class BackupModule {}
