import { BadRequestException } from '@nestjs/common';
import { BackupRun, BackupRunStatus } from '../src/backup/entities/backup-run.entity';
import { assertRestorableRun, restoreWorkingDirectory, walGBackupName } from '../src/restore/restore-execution';

describe('restore execution helpers', () => {
  it('builds isolated restore working directories', () => {
    expect(restoreWorkingDirectory('00000000-0000-0000-0000-000000000001'))
      .toBe('/tmp/backups-restore/00000000-0000-0000-0000-000000000001');
    expect(() => restoreWorkingDirectory('../bad')).toThrow(BadRequestException);
  });

  it('extracts WAL-G backup names when present and falls back to LATEST', () => {
    expect(walGBackupName({ walg_output: 'backup_name: base_0001' } as BackupRun)).toBe('base_0001');
    expect(walGBackupName({ walg_output: '' } as BackupRun)).toBe('LATEST');
  });

  it('allows only successful backup runs to restore', () => {
    expect(() => assertRestorableRun({ status: BackupRunStatus.SUCCESS } as BackupRun)).not.toThrow();
    expect(() => assertRestorableRun({ status: BackupRunStatus.FAILED } as BackupRun)).toThrow(BadRequestException);
  });
});
