import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { EntityManager, In, Repository } from 'typeorm';
import { RestoreRequest, RestoreStatus } from './entities/restore-request.entity';
import { CreateRestoreDto } from './dto/create-restore.dto';
import { BackupService } from '../backup/backup.service';
import { BackupRun, VerificationStatus } from '../backup/entities/backup-run.entity';
import { BackupTarget } from '../targets/entities/backup-target.entity';
import { TargetsService } from '../targets/targets.service';
import { WalgWrapperService } from '../backup/walg-wrapper.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-event.entity';
import { LoggerService } from '../../shared/logger/logger.service';
import { BackupRunLockService, isLockTimeout } from '../common/backup-run-lock.service';
import { SchemaReadinessService } from '../schema/schema-readiness.service';
import {
  RESTORE_ACTIVE_TARGET_INDEX,
  RESTORE_IDEMPOTENCY_INDEX,
} from './restore-constraints';
import {
  assertPostgresRestoreTarget,
  assertRestorableRun,
  logicalRestoreLocation,
} from './restore-execution';

export const ACTIVE_RESTORE_STATUSES = [RestoreStatus.PENDING, RestoreStatus.RUNNING];
export const TERMINAL_RESTORE_STATUSES = [RestoreStatus.COMPLETED, RestoreStatus.FAILED];
const UNIQUE_VIOLATION = '23505';

type ClaimOutcome = 'claimed' | 'not_pending' | 'deferred';

function clean(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function restoreError(output: string): string {
  const normalized = clean(output);
  return (normalized || 'PostgreSQL restore failed without diagnostic output.').slice(-500);
}

export function restoreIdempotencyKey(dto: CreateRestoreDto, requestedBy: string): string {
  const supplied = clean(dto.idempotency_key);
  if (supplied) return supplied;
  const payload = JSON.stringify([
    clean(dto.backup_run_id),
    clean(dto.target_id),
    clean(dto.approval_actor),
    clean(dto.approval_reason),
    clean(requestedBy),
  ]);
  return `derived:${createHash('sha256').update(payload).digest('hex')}`;
}

function uniqueViolationTarget(error: unknown): string | null {
  const candidates = [error, (error as { driverError?: unknown })?.driverError];
  for (const candidate of candidates) {
    const driver = candidate as { code?: string; constraint?: string; detail?: string } | undefined;
    if (driver?.code === UNIQUE_VIOLATION) {
      return `${driver.constraint || ''} ${driver.detail || ''}`;
    }
  }
  return null;
}

@Injectable()
export class RestoreService {
  /**
   * Requests this process is actively executing. It is advisory only - execution
   * is serialized by the database claim, not by this set - but it lets the
   * reconciler tell "running and alive here" apart from "running and abandoned by
   * a process that died", so recovery never terminates a live restore.
   */
  private readonly inFlight = new Set<string>();

  constructor(
    @InjectRepository(RestoreRequest) private repo: Repository<RestoreRequest>,
    @InjectRepository(BackupRun) private backupRunRepo: Repository<BackupRun>,
    private backupService: BackupService,
    private targetsService: TargetsService,
    private walg: WalgWrapperService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private logger: LoggerService,
    private runLock: BackupRunLockService,
    private schemaReadiness: SchemaReadinessService,
  ) {}

  isInFlight(requestId: string): boolean {
    return this.inFlight.has(requestId);
  }

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

    // Destructive traffic is refused outright when the database cannot serialize
    // restores per target. Accepting it would mean trusting application-level
    // checks alone for an operation that overwrites a production database.
    this.schemaReadiness.assertRestoreSerializationReady();

    const idempotencyKey = restoreIdempotencyKey(dto, requestedBy);
    const replayed = await this.findByIdempotencyKey(idempotencyKey);
    if (replayed) return this.logReplay(replayed, idempotencyKey);

    const backupRun = await this.backupService.findOne(dto.backup_run_id);
    const target = await this.targetsService.findOne(dto.target_id);
    if (backupRun.job?.target_id && backupRun.job.target_id !== target.id) {
      throw new BadRequestException('Restore target must match the selected backup run target.');
    }
    assertRestorableRun(backupRun);
    assertPostgresRestoreTarget(target);
    logicalRestoreLocation(backupRun);

    let pin: { request: RestoreRequest; replayed: boolean };
    try {
      pin = await this.createPin(dto, target, backupRun, requestedBy, idempotencyKey);
    } catch (error) {
      if (isLockTimeout(error)) {
        this.logger.operation({
          event: 'restore.request.lock_unavailable',
          level: 'warn',
          message: 'Restore request refused because the backup run lock could not be taken in time',
          context: 'RestoreService',
          metadata: { target_id: dto.target_id, backup_run_id: dto.backup_run_id },
        });
        throw new ServiceUnavailableException(
          'The selected backup run is locked by another retention or restore operation. Retry shortly.',
        );
      }
      const violation = uniqueViolationTarget(error);
      if (violation === null) throw error;
      if (violation.includes(RESTORE_IDEMPOTENCY_INDEX) || violation.includes('idempotency_key')) {
        const existing = await this.findByIdempotencyKey(idempotencyKey);
        if (existing) return this.logReplay(existing, idempotencyKey);
      }
      this.logger.operation({
        event: 'restore.request.serialized',
        level: 'warn',
        message: 'Restore request rejected by database serialization constraint',
        context: 'RestoreService',
        metadata: { target_id: dto.target_id, backup_run_id: dto.backup_run_id, constraint: violation.trim() || RESTORE_ACTIVE_TARGET_INDEX },
      });
      throw new ConflictException('A restore request is already pending or running for this target.');
    }

    if (pin.replayed) return this.logReplay(pin.request, idempotencyKey);

    this.executeRestore(pin.request.id).catch((err) =>
      this.logger.error(`Restore execution error: ${err}`, err.stack, 'RestoreService'),
    );

    return pin.request;
  }

  /**
   * Creates the pending request - the pin that stops retention from removing the
   * object - together with its audit event, inside one transaction that holds the
   * backup run's advisory lock.
   *
   * Two guarantees come from that single transaction. Retention cannot delete the
   * object between the last validation and the pin, because it must hold the same
   * lock to decide. And an audit failure rolls the pending row back instead of
   * leaving an unexplained request that permanently occupies the target's single
   * active-restore slot.
   */
  private createPin(
    dto: CreateRestoreDto,
    target: BackupTarget,
    backupRun: BackupRun,
    requestedBy: string,
    idempotencyKey: string,
  ): Promise<{ request: RestoreRequest; replayed: boolean }> {
    return this.runLock.withBackupRunLock(dto.backup_run_id, async (manager) => {
      const lockedRun = await manager.findOne(BackupRun, { where: { id: dto.backup_run_id } });
      if (!lockedRun) throw new BadRequestException('Backup run no longer exists.');
      assertRestorableRun(lockedRun);
      logicalRestoreLocation(lockedRun);

      // Re-read under the lock: a duplicate submission that lost the race to this
      // point must replay the original request, not collide with it as a conflict.
      const duplicate = await manager.findOne(RestoreRequest, { where: { idempotency_key: idempotencyKey } });
      if (duplicate) return { request: duplicate, replayed: true };

      const active = await manager.findOne(RestoreRequest, {
        where: { target_id: dto.target_id, status: In(ACTIVE_RESTORE_STATUSES) },
      });
      if (active) {
        throw new ConflictException('A restore request is already pending or running for this target.');
      }

      const saved = await manager.save(
        RestoreRequest,
        manager.create(RestoreRequest, {
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
          idempotency_key: idempotencyKey,
        }),
      );

      await this.audit.record({
        action: AuditAction.RESTORE_REQUEST_CREATED,
        actor: requestedBy,
        target_id: target.id,
        job_id: backupRun.job_id,
        backup_run_id: backupRun.id,
        restore_request_id: saved.id,
        reason: saved.approval_reason,
        metadata: { approval_actor: saved.approval_actor },
      }, manager);

      return { request: saved, replayed: false };
    });
  }

  private async findByIdempotencyKey(idempotencyKey: string): Promise<RestoreRequest | null> {
    const existing = await this.repo.findOne({ where: { idempotency_key: idempotencyKey } });
    return existing ?? null;
  }

  private logReplay(request: RestoreRequest, idempotencyKey: string): RestoreRequest {
    this.logger.operation({
      event: 'restore.request.replayed',
      message: 'Duplicate restore submission returned the original request without starting a second execution',
      context: 'RestoreService',
      metadata: {
        request_id: request.id,
        target_id: request.target_id,
        backup_run_id: request.backup_run_id,
        status: request.status,
        idempotency_key: idempotencyKey,
      },
    });
    return request;
  }

  /**
   * Moves a request from pending to running with a single conditional UPDATE so a
   * duplicate execution attempt can never run the same restore twice, and marks
   * the backup run as verifying in the same locked transaction so retention can
   * never observe a claimed restore whose object is not yet pinned.
   */
  private async claimForExecution(request: RestoreRequest, backupRun: BackupRun): Promise<ClaimOutcome> {
    const startedAt = new Date();
    let claimed: boolean;
    try {
      claimed = await this.runLock.withBackupRunLock(request.backup_run_id, async (manager) => {
        const result = await manager.update(
          RestoreRequest,
          { id: request.id, status: RestoreStatus.PENDING },
          { status: RestoreStatus.RUNNING, started_at: startedAt },
        );
        if ((result?.affected ?? 0) !== 1) return false;
        await manager.update(
          BackupRun,
          { id: backupRun.id },
          {
            verification_status: VerificationStatus.VERIFYING,
            verification_checked_at: startedAt,
            verification_reason: `Approved restore request ${request.id} is running.`,
          },
        );
        return true;
      });
    } catch (error) {
      this.logger.operation({
        event: 'restore.request.claim_deferred',
        level: 'warn',
        message: isLockTimeout(error)
          ? 'Restore claim deferred because the backup run lock was held by retention'
          : `Restore claim deferred: ${error instanceof Error ? error.message : 'unknown error'}`,
        context: 'RestoreService',
        metadata: { request_id: request.id, backup_run_id: request.backup_run_id },
      });
      return 'deferred';
    }

    if (!claimed) return 'not_pending';

    request.status = RestoreStatus.RUNNING;
    request.started_at = startedAt;
    backupRun.verification_status = VerificationStatus.VERIFYING;
    backupRun.verification_checked_at = startedAt;
    backupRun.verification_reason = `Approved restore request ${request.id} is running.`;
    return 'claimed';
  }

  /** Restart-safe re-dispatch for a request that was never picked up for execution. */
  resumeExecution(requestId: string): Promise<void> {
    return this.executeRestore(requestId);
  }

  private executeRestore(requestId: string): Promise<void> {
    this.inFlight.add(requestId);
    return this.runExecution(requestId).finally(() => {
      this.inFlight.delete(requestId);
    });
  }

  private async runExecution(requestId: string): Promise<void> {
    const request = await this.findOne(requestId);
    const backupRun = await this.backupService.findOne(request.backup_run_id);
    const target = await this.targetsService.findOne(request.target_id);

    let storagePrefix: string;
    let objectName: string;
    try {
      if (backupRun.job?.target_id && backupRun.job.target_id !== target.id) {
        throw new BadRequestException('Restore target must match the selected backup run target.');
      }
      assertRestorableRun(backupRun);
      assertPostgresRestoreTarget(target);
      ({ storagePrefix, objectName } = logicalRestoreLocation(backupRun));
    } catch (error) {
      await this.recordFailure(request, backupRun, target, error instanceof Error ? error.message : 'Restore validation failed.');
      return;
    }

    const claim = await this.claimForExecution(request, backupRun);
    if (claim !== 'claimed') {
      this.logger.operation({
        event: claim === 'deferred' ? 'restore.request.claim_retry_pending' : 'restore.request.claim_skipped',
        level: 'warn',
        message: claim === 'deferred'
          ? 'Restore execution left pending for reconciliation because the claim could not be taken'
          : 'Restore execution skipped because the request was no longer pending',
        context: 'RestoreService',
        metadata: { request_id: request.id, target_id: target.id, status: request.status },
      });
      return;
    }

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
      { storage_prefix: storagePrefix },
      target,
      process.env.DB_PASSWORD || '',
    );
    const result = await this.walg.restoreFromObject(env, objectName, target.database_name);

    request.walg_output = result.output;

    if (result.exitCode !== 0) {
      await this.recordFailure(request, backupRun, target, result.output);
      return;
    }

    await this.recordSuccess(request, backupRun, target);
  }

  /**
   * Terminal transitions are written together with their audit event inside one
   * locked transaction, guarded by a re-read of the request. A request that some
   * other path already finished is never rewritten, so a recovered request and a
   * live execution can never both claim the outcome.
   */
  private async persistTerminalState(
    request: RestoreRequest,
    backupRun: BackupRun,
    target: BackupTarget,
    status: RestoreStatus.COMPLETED | RestoreStatus.FAILED,
    error: string | null,
    action: AuditAction,
    metadata: Record<string, unknown> | null,
  ): Promise<boolean> {
    const completedAt = new Date();

    const applied = await this.runLock.withBackupRunLock(request.backup_run_id, async (manager: EntityManager) => {
      const fresh = await manager.findOne(RestoreRequest, { where: { id: request.id } });
      if (fresh && TERMINAL_RESTORE_STATUSES.includes(fresh.status)) return false;

      request.status = status;
      request.completed_at = completedAt;
      request.error_message = error;

      backupRun.verification_status = status === RestoreStatus.COMPLETED
        ? VerificationStatus.VERIFIED
        : VerificationStatus.FAILED;
      backupRun.verification_checked_at = completedAt;
      backupRun.verification_reason = status === RestoreStatus.COMPLETED
        ? `Restore request ${request.id} completed successfully.`
        : `Restore request ${request.id} failed.`;
      backupRun.verification_error = error;

      await manager.save(BackupRun, backupRun);
      await manager.save(RestoreRequest, request);
      await this.audit.record({
        action,
        actor: request.requested_by || request.approval_actor,
        target_id: target.id,
        backup_run_id: backupRun.id,
        restore_request_id: request.id,
        reason: request.approval_reason || (status === RestoreStatus.COMPLETED
          ? 'Restore completed after approved request.'
          : 'Restore failed after approved request.'),
        metadata,
      }, manager);
      return true;
    });

    if (!applied) {
      this.logger.operation({
        event: 'restore.request.terminal_skipped',
        level: 'warn',
        message: 'Terminal restore state was not written because the request is already terminal',
        context: 'RestoreService',
        metadata: { request_id: request.id, target_id: target.id, attempted_status: status },
      });
    }
    return applied;
  }

  private async recordSuccess(request: RestoreRequest, backupRun: BackupRun, target: BackupTarget): Promise<void> {
    const applied = await this.persistTerminalState(
      request,
      backupRun,
      target,
      RestoreStatus.COMPLETED,
      null,
      AuditAction.RESTORE_EXECUTION_COMPLETED,
      null,
    );
    if (!applied) return;

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
  }

  private async recordFailure(
    request: RestoreRequest,
    backupRun: BackupRun,
    target: BackupTarget,
    output: string,
    metadata: Record<string, unknown> | null = null,
  ): Promise<boolean> {
    const error = restoreError(output);
    const applied = await this.persistTerminalState(
      request,
      backupRun,
      target,
      RestoreStatus.FAILED,
      error,
      AuditAction.RESTORE_EXECUTION_FAILED,
      { error_tail: error, ...(metadata || {}) },
    );
    if (!applied) return false;

    await this.notifications.restoreFailed(target.name, {
      request_id: request.id,
      backup_run_id: backupRun.id,
      error,
    });
    await this.notifications.verificationFailed(target.name, {
      request_id: request.id,
      backup_run_id: backupRun.id,
      error,
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
        error,
      },
    });
    return true;
  }

  /**
   * Terminal recovery for a request no live execution owns.
   *
   * A running request whose process died cannot be resumed: `pg_restore` runs in a
   * single transaction, so an interrupted restore has already rolled back, and
   * re-running it would be a second destructive execution nobody approved. It is
   * failed explicitly instead - which records the outcome, notifies, and frees the
   * target's single active slot - and a retry has to be a new approved request
   * with its own idempotency key.
   *
   * A pending request whose approval is older than the abandon window is failed
   * for the same reason: a stale approval must not fire hours later by surprise.
   */
  async terminateStaleRequest(
    requestId: string,
    expected: RestoreStatus.PENDING | RestoreStatus.RUNNING,
    reason: string,
  ): Promise<boolean> {
    if (this.inFlight.has(requestId)) return false;

    const request = await this.repo.findOne({ where: { id: requestId } });
    if (!request || request.status !== expected) return false;

    const backupRun = await this.backupService.findOne(request.backup_run_id);
    const target = await this.targetsService.findOne(request.target_id);

    const applied = await this.recordFailure(request, backupRun, target, reason, {
      recovery: expected === RestoreStatus.RUNNING ? 'interrupted_execution' : 'abandoned_approval',
    });

    if (applied) {
      this.logger.operation({
        event: 'restore.request.recovered',
        level: 'warn',
        message: 'Stranded restore request was failed terminally so the target is no longer blocked',
        context: 'RestoreService',
        metadata: {
          request_id: request.id,
          target_id: request.target_id,
          backup_run_id: request.backup_run_id,
          previous_status: expected,
        },
      });
    }
    return applied;
  }
}
