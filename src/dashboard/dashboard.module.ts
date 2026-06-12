import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupRun } from '../backup/entities/backup-run.entity';
import { BackupJob } from '../jobs/entities/backup-job.entity';
import { RestoreRequest } from '../restore/entities/restore-request.entity';
import { BackupTarget } from '../targets/entities/backup-target.entity';
import { BackupDestination } from '../destinations/entities/backup-destination.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([BackupTarget, BackupJob, BackupRun, RestoreRequest, BackupDestination])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
