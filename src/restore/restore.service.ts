import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestoreRequest, RestoreStatus } from './entities/restore-request.entity';
import { CreateRestoreDto } from './dto/create-restore.dto';
import { BackupService } from '../backup/backup.service';
import { BackupRun, VerificationStatus } from '../backup/entities/backup-run.entity';
import { TargetsService } from '../targets/targets.service';
import { WalgWrapperService } from '../backup/walg-wrapper.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-event.entity';
import { LoggerService } from '../../shared/logger/logger.service';
import { assertRestorableRun, restoreWorkingDirectory, walGBackupName } from './restore-execution';

function clean(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

@Injectable()
export class RestoreService {
  constructor(
    @InjectRepository(RestoreRequest) private repo: Repository<RestoreRequest>,
    @InjectRepository(BackupRun) private backupRunRepo: Repository<BackupRun>,
    private backupService: BackupService,
    private targetsService: TargetsService,
    private walg: WalgWrapperService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private logger: LoggerService,
  ) {}

  findAll(): Promise<RestoreRequest[]> {
    return this.repo.find({ order: { created_at: 'DESC' }, relations: ['backup_run', 'target'] });
  }

  async findOne(id: string): Promise<RestoreRequest> {
    const req = await this.repo.findOne({ where: { id }, relations: ['backup_run', 'target'] });
    if (!req) throw new Error(`RestoreRequest ${id} not found`);
    return req;
  }

  public toPublicRequest(request: RestoreRequest): Record<string, unknown> {
    const { walg_output, backup_run, ...publicRequest } = request as RestoreRequest & { walg_output?: string };
    const publicBackupRun = backup_run ? this.backupService.toPublicRun(backup_run) : undefined;
    return { ...publicRequest, backup_run: publicBackupRun };
  }

  async create(dto: CreateRestoreDto, requestedBy: string): Promise<RestoreRequest> {
    if (dto.approval_confirmed_backup_run_id !== dto.backup_run_id) {
      throw new BadRequestException('Restore approval must confirm the exact backup run ID.');
    }
    if (dto.approval_confirmed_target_id !== dto.target_id) {
      throw new BadRequestException('Restore approval must confirm the exact target ID.');
    }
    if (dto.production_restore_approved !== true) {
      throw new BadRequestException('Production restore approval checkbox is required.');
    }
    if (!clean(dto.approval_actor) || clean(dto.approval_reason).length < 12) {
      throw new BadRequestException('Restore approval actor and reason are required.');
    }

    const request = await this.repo.save(
      this.repo.create({
        backup_run_id: dto.backup_run_id,
        target_id: dto.target_id,
        status: RestoreStatus.PENDING,
        requested_by: requestedBy,
        approval_actor: clean(dto.approval_actor),
        approval_reason: clean(dto.approval_reason),
        approval_confirmed_target_id: dto.approval_confirmed_target_id,
        approval_confirmed_backup_run_id: dto.approval_confirmed_backup_run_id,
        production_restore_approved: true,
        approved_at: new Date(),
      }),
    );

    await this.audit.record({
      action: AuditAction.RESTORE_REQUEST_CREATED,
      actor: requestedBy,
      target_id: request.target_id,
      backup_run_id: request.backup_run_id,
      restore_request_id: request.id,
      reason: request.approval_reason,
      metadata: { approval_actor: request.approval_actor },
    });

    this.executeRestore(request.id).catch((err) =>
      this.logger.error(`Restore execution error: ${err}`, err.stack, 'RestoreService'),
    );

    return request;
  }

  private async executeRestore(requestId: string): Promise<void> {
    const request = await this.findOne(requestId);
    const backupRun = await this.backupService.findOne(request.backup_run_id);
    assertRestorableRun(backupRun);
    const target = await this.targetsService.findOne(request.target_id);

    backupRun.verification_status = VerificationStatus.VERIFYING;
    backupRun.verification_checked_at = new Date();
    backupRun.verification_reason = `Approved restore request ${request.id} is running.`;
    await this.backupRunRepo.save(backupRun);

    request.status = RestoreStatus.RUNNING;
    request.started_at = new Date();
    await this.repo.save(request);
    this.logger.operation({
      event: 'restore.request.started',
      message: 'Approved restore request started',
      context: 'RestoreService',
      metadata: {
        request_id: request.id,
        backup_run_id: backupRun.id,
        target_id: target.id,
        actor: request.requested_by || request.approval_actor,
      },
    });

    const env = this.walg.buildEnv(
      { storage_prefix: backupRun.storage_path || undefined },
      target,
      process.env.DB_PASSWORD || '',
    );

    let output = '';
    const result = await this.walg.run(
      ['pgbackup-fetch', restoreWorkingDirectory(request.id), walGBackupName(backupRun)],
      env,
      (chunk) => { output += chunk; },
    );

    request.walg_output = output;
    request.completed_at = new Date();

    if (result.exitCode === 0) {
      request.status = RestoreStatus.COMPLETED;
      backupRun.verification_status = VerificationStatus.VERIFIED;
      backupRun.verification_checked_at = new Date();
      backupRun.verification_reason = `Restore request ${request.id} completed successfully.`;
      backupRun.verification_error = null;
      await this.backupRunRepo.save(backupRun);
      await this.repo.save(request);
      await this.audit.record({
        action: AuditAction.RESTORE_EXECUTION_COMPLETED,
        actor: request.requested_by || request.approval_actor,
        target_id: target.id,
        backup_run_id: backupRun.id,
        restore_request_id: request.id,
        reason: request.approval_reason || 'Restore completed after approved request.',
      });
      await this.notifications.restoreCompleted(target.name, {
        request_id: request.id,
        backup_run_id: backupRun.id,
      });
      await this.notifications.verificationVerified(target.name, {
        request_id: request.id,
        backup_run_id: backupRun.id,
      });
      this.logger.operation({
        event: 'restore.request.completed',
        message: `Restore request completed for target ${target.name}`,
        context: 'RestoreService',
        metadata: {
          request_id: request.id,
          backup_run_id: backupRun.id,
          target_id: target.id,
          verification_status: backupRun.verification_status,
        },
      });
    } else {
      request.status = RestoreStatus.FAILED;
      request.error_message = output.slice(-500);
      backupRun.verification_status = VerificationStatus.FAILED;
      backupRun.verification_checked_at = new Date();
      backupRun.verification_reason = `Restore request ${request.id} failed.`;
      backupRun.verification_error = request.error_message;
      await this.backupRunRepo.save(backupRun);
      await this.repo.save(request);
      await this.audit.record({
        action: AuditAction.RESTORE_EXECUTION_FAILED,
        actor: request.requested_by || request.approval_actor,
        target_id: target.id,
        backup_run_id: backupRun.id,
        restore_request_id: request.id,
        reason: request.approval_reason || 'Restore failed after approved request.',
        metadata: { error_tail: request.error_message },
      });
      await this.notifications.restoreFailed(target.name, {
        request_id: request.id,
        backup_run_id: backupRun.id,
        error: request.error_message,
      });
      await this.notifications.verificationFailed(target.name, {
        request_id: request.id,
        backup_run_id: backupRun.id,
        error: request.error_message,
      });
      this.logger.operation({
        event: 'restore.request.failed',
        level: 'error',
        message: `Restore request failed for target ${target.name}`,
        context: 'RestoreService',
        metadata: {
          request_id: request.id,
          backup_run_id: backupRun.id,
          target_id: target.id,
          error: request.error_message,
        },
      });
    }
  }
}
