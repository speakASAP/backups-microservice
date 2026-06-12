import {
  BackupRunStatus,
  TriggerType,
  VerificationStatus,
} from '../src/backup/entities/backup-run.entity';

describe('BackupRun entity enums', () => {
  it('status values are defined', () => {
    expect(BackupRunStatus.RUNNING).toBe('running');
    expect(BackupRunStatus.SUCCESS).toBe('success');
    expect(BackupRunStatus.FAILED).toBe('failed');
    expect(BackupRunStatus.VERIFYING).toBe('verifying');
  });

  it('trigger types are defined', () => {
    expect(TriggerType.SCHEDULER).toBe('scheduler');
    expect(TriggerType.MANUAL).toBe('manual');
  });

  it('verification status values are defined', () => {
    expect(VerificationStatus.UNKNOWN).toBe('unknown');
    expect(VerificationStatus.PENDING).toBe('pending');
    expect(VerificationStatus.VERIFYING).toBe('verifying');
    expect(VerificationStatus.VERIFIED).toBe('verified');
    expect(VerificationStatus.FAILED).toBe('failed');
    expect(VerificationStatus.SKIPPED).toBe('skipped');
  });
});
