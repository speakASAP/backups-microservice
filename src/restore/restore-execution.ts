import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { BackupRun, BackupRunStatus } from '../backup/entities/backup-run.entity';

const RESTORE_ROOT = '/tmp/backups-restore';

export function restoreWorkingDirectory(requestId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
    throw new BadRequestException('Invalid restore request ID for restore working directory.');
  }
  return path.join(RESTORE_ROOT, requestId);
}

export function walGBackupName(run: BackupRun): string {
  const output = run.walg_output || '';
  const match = output.match(/backup_name[:=]\s*([^\s]+)/i)
    || output.match(/name[:=]\s*([^\s]+)/i)
    || output.match(/Backup\s+([A-Za-z0-9_\-T:.Z]+)/i);
  return match?.[1] || 'LATEST';
}

export function assertRestorableRun(run: BackupRun): void {
  if (run.status !== BackupRunStatus.SUCCESS) {
    throw new BadRequestException('Only successful backup runs can be restored.');
  }
}
