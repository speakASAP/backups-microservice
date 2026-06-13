import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestoreRequest } from './entities/restore-request.entity';
import { BackupRun } from '../backup/entities/backup-run.entity';
import { RestoreService } from './restore.service';
import { RestoreController } from './restore.controller';
import { BackupModule } from '../backup/backup.module';
import { TargetsModule } from '../targets/targets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoggerModule } from '../../shared/logger/logger.module';
import { WalgModule } from '../backup/walg.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([RestoreRequest, BackupRun]), BackupModule, TargetsModule, NotificationsModule, LoggerModule, WalgModule, AuditModule],
  providers: [RestoreService],
  controllers: [RestoreController],
})
export class RestoreModule {}
