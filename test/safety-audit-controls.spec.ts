import { BadRequestException } from '@nestjs/common';
import { BackupService } from '../src/backup/backup.service';
import { JobsService } from '../src/jobs/jobs.service';
import { RestoreService } from '../src/restore/restore.service';
import { AuditAction } from '../src/audit/audit-log.entity';

const makeRepo = () => ({
  create: jest.fn((input) => input),
  save: jest.fn(async (input) => ({ id: input.id || 'saved-id', ...input })),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('Goal 06 safety and audit controls', () => {
  it('requires approval metadata for retention below three full backups', async () => {
    const repo = makeRepo();
    const audit = { record: jest.fn() };
    const service = new JobsService(repo as any, audit as any);

    await expect(service.create({
      target_id: '11111111-1111-4111-8111-111111111111',
      name: 'unsafe-retention',
      schedule_cron: '0 1 * * *',
      retention_full_count: 2,
    })).rejects.toBeInstanceOf(BadRequestException);

    await service.create({
      target_id: '11111111-1111-4111-8111-111111111111',
      name: 'approved-retention',
      schedule_cron: '0 1 * * *',
      retention_full_count: 2,
      retention_approval_actor: 'owner@example.test',
      retention_approval_reason: 'temporary incident response window',
    }, 'operator@example.test');

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.RETENTION_POLICY_APPROVED,
      actor: 'operator@example.test',
      reason: 'temporary incident response window',
      metadata: expect.objectContaining({ retain_count: 2, approved_by: 'owner@example.test' }),
    }));
  });

  it('blocks physical backup-run deletion and records audit evidence', async () => {
    const runRepo = makeRepo();
    runRepo.findOne.mockResolvedValue({
      id: 'run-1',
      job_id: 'job-1',
      job: { target_id: 'target-1' },
      storage_path: 's3://internal/path',
      walg_output: 'sensitive command output',
    });
    const audit = { record: jest.fn() };
    const service = new BackupService(
      runRepo as any,
      makeRepo() as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      audit as any,
      { log: jest.fn(), error: jest.fn() } as any,
      {} as any,
    );

    await expect(service.remove('run-1', 'operator@example.test', {})).rejects.toBeInstanceOf(BadRequestException);

    const result = await service.remove('run-1', 'operator@example.test', {
      approval_actor: 'owner@example.test',
      approval_reason: 'review duplicate evidence request',
    });

    expect(result.status).toBe('blocked');
    expect(runRepo.remove).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.BACKUP_RUN_DELETION_BLOCKED,
      actor: 'operator@example.test',
      target_id: 'target-1',
      job_id: 'job-1',
      backup_run_id: 'run-1',
      reason: 'review duplicate evidence request',
      metadata: expect.objectContaining({ physical_delete: false, approved_by: 'owner@example.test' }),
    }));
  });

  it('omits storage path and WAL-G output from public backup-run responses', () => {
    const service = new BackupService(
      makeRepo() as any,
      makeRepo() as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { log: jest.fn(), error: jest.fn() } as any,
      {} as any,
    );

    const publicRun = service.toPublicRun({
      id: 'run-1',
      job_id: 'job-1',
      storage_path: 's3://internal/path',
      walg_output: 'raw command output',
      status: 'success',
    } as any);

    expect(publicRun).toMatchObject({ id: 'run-1', job_id: 'job-1', status: 'success' });
    expect(publicRun).not.toHaveProperty('storage_path');
    expect(publicRun).not.toHaveProperty('walg_output');
  });

  it('requires explicit production restore approval evidence', async () => {
    const repo = makeRepo();
    const backupService = {
      findOne: jest.fn(async () => ({ id: 'run-1', job_id: 'job-1', job: { target_id: 'target-1' } })),
    };
    const targetsService = { findOne: jest.fn(async () => ({ id: 'target-1', name: 'postgres-main' })) };
    const audit = { record: jest.fn() };
    const service = new RestoreService(
      repo as any,
      backupService as any,
      targetsService as any,
      {} as any,
      {} as any,
      audit as any,
      { error: jest.fn() } as any,
    );
    (service as any).executeRestore = jest.fn(async () => undefined);

    await expect(service.create({
      backup_run_id: '11111111-1111-4111-8111-111111111111',
      target_id: '22222222-2222-4222-8222-222222222222',
      target_environment: 'production',
      approval_reason: 'missing confirmation',
    }, 'operator@example.test')).rejects.toBeInstanceOf(BadRequestException);

    await service.create({
      backup_run_id: '11111111-1111-4111-8111-111111111111',
      target_id: '22222222-2222-4222-8222-222222222222',
      target_environment: 'production',
      approval_actor: 'owner@example.test',
      approval_reason: 'approved incident restore',
      approval_confirmed: true,
    }, 'operator@example.test');

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.RESTORE_REQUESTED,
      actor: 'operator@example.test',
      target_id: 'target-1',
      job_id: 'job-1',
      backup_run_id: 'run-1',
      reason: 'approved incident restore',
      metadata: expect.objectContaining({ environment: 'production', approved_by: 'owner@example.test' }),
    }));
  });
});
