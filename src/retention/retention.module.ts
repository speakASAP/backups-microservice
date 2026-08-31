import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetentionService } from './retention.service';
import { WalgModule } from '../backup/walg.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoggerModule } from '../../shared/logger/logger.module';
import { CommonModule } from '../common/common.module';
import { BackupRun } from '../backup/entities/backup-run.entity';
import { RestoreRequest } from '../restore/entities/restore-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BackupRun, RestoreRequest]),
    WalgModule,
    NotificationsModule,
    LoggerModule,
    CommonModule,
  ],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
