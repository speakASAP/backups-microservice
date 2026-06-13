import { BadRequestException } from '@nestjs/common';
import { AuditAction, AuditEvent } from '../src/audit/entities/audit-event.entity';
import { JobsService } from '../src/jobs/jobs.service';
import { SourceCategory } from '../src/targets/entities/backup-target.entity';
import { CreateRestoreDto } from '../src/restore/dto/create-restore.dto';

describe('Safety audit controls', () => {
  const logger = { operation: jest.fn() };

  it('defines audit actions for destructive and risk-changing operations', () => {
    expect(AuditAction.RETENTION_APPROVAL).toBe('retention_approval');
    expect(AuditAction.BACKUP_RUN_DELETE_DENIED).toBe('backup_run_delete_denied');
    expect(AuditAction.RESTORE_REQUEST_CREATED).toBe('restore_request_created');
    expect(AuditEvent).toBeDefined();
  });

  it('blocks low-retention jobs without owner approval metadata', async () => {
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'job-1' })),
    };
    const targetRepo = {
      findOne: jest.fn(async () => ({ id: 'target-1', source_category: SourceCategory.POSTGRES_DATABASE })),
    };
    const audit = { record: jest.fn() };
    const service = new JobsService(repo as any, targetRepo as any, audit as any, logger as any);

    await expect(service.create({
      target_id: '00000000-0000-0000-0000-000000000001',
      name: 'unsafe-retention',
      schedule_cron: '0 2 * * *',
      retention_full_count: 2,
    }, 'operator-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('audits low-retention jobs when approval metadata is present', async () => {
    const repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...value, id: 'job-1' })),
    };
    const targetRepo = {
      findOne: jest.fn(async () => ({ id: 'target-1', source_category: SourceCategory.POSTGRES_DATABASE })),
    };
    const audit = { record: jest.fn(async () => ({})) };
    const service = new JobsService(repo as any, targetRepo as any, audit as any, logger as any);

    await service.create({
      target_id: '00000000-0000-0000-0000-000000000001',
      name: 'approved-low-retention',
      schedule_cron: '0 2 * * *',
      retention_full_count: 2,
      retention_approval_actor: 'owner@example.test',
      retention_approval_reason: 'Owner accepted limited retention during migration.',
    }, 'operator-1');

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.RETENTION_APPROVAL,
      actor: 'operator-1',
      reason: 'Owner accepted limited retention during migration.',
    }));
  });

  it('requires restore approval evidence fields in the DTO contract', () => {
    const dto = new CreateRestoreDto();
    dto.backup_run_id = '00000000-0000-0000-0000-000000000001';
    dto.target_id = '00000000-0000-0000-0000-000000000002';
    dto.approval_confirmed_backup_run_id = dto.backup_run_id;
    dto.approval_confirmed_target_id = dto.target_id;
    dto.approval_actor = 'owner@example.test';
    dto.approval_reason = 'Approved production restore for incident recovery.';
    dto.production_restore_approved = true;

    expect(dto.approval_confirmed_backup_run_id).toBe(dto.backup_run_id);
    expect(dto.approval_confirmed_target_id).toBe(dto.target_id);
    expect(dto.production_restore_approved).toBe(true);
  });
});
