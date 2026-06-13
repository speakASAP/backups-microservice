import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupJob } from './entities/backup-job.entity';
import { BackupTarget } from '../targets/entities/backup-target.entity';
import { AuditModule } from '../audit/audit.module';
import { LoggerModule } from '../../shared/logger/logger.module';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BackupJob, BackupTarget]), AuditModule, LoggerModule],
  providers: [JobsService],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
