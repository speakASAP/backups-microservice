import { Module } from '@nestjs/common';
import { BackupRunLockService } from './backup-run-lock.service';

@Module({
  providers: [BackupRunLockService],
  exports: [BackupRunLockService],
})
export class CommonModule {}
