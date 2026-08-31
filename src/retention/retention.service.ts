import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import {
  WalgWrapperService,
  WalgEnv,
  logicalBackupObjectName,
  logicalBackupStoragePath,
} from '../backup/walg-wrapper.service';
import { BackupRun, BackupRunStatus, VerificationStatus } from '../backup/entities/backup-run.entity';
import { RestoreRequest, RestoreStatus } from '../restore/entities/restore-request.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { LoggerService } from '../../shared/logger/logger.service';
import { BackupJob } from '../jobs/entities/backup-job.entity';
import { BackupRunLockService, isLockTimeout } from '../common/backup-run-lock.service';

export const ACTIVE_RESTORE_STATUSES = [RestoreStatus.PENDING, RestoreStatus.RUNNING];

type CandidateOutcome = 'deleted' | 'pinned' | 'failed';

@Injectable()
export class RetentionService {
  constructor(
    @InjectRepository(BackupRun) private runRepo: Repository<BackupRun>,
    @InjectRepository(RestoreRequest) private restoreRepo: Repository<RestoreRequest>,
    private walg: WalgWrapperService,
    private notifications: NotificationsService,
    private logger: LoggerService,
    private runLock: BackupRunLockService,
  ) {}

  /**
   * Resolves the exact deterministic object for a run, but only when the recorded
   * storage path is byte-identical to the path this job would have written. A null,
   * blank, foreign, or rewritten path resolves to null so the run can neither be
   * deleted nor act as the verified safety anchor.
   */
  private deterministicObject(env: WalgEnv, run: BackupRun): string | null {
    const storagePath = run.storage_path;
    if (typeof storagePath !== 'string' || storagePath.trim() === '') return null;

    let objectName: string;
    try {
      objectName = logicalBackupObjectName(run.id);
    } catch {
      return null;
    }

    const expectedPath = logicalBackupStoragePath(env.WALG_S3_PREFIX, objectName);
    return storagePath === expectedPath ? objectName : null;
  }

  private async pinnedRunIds(runs: BackupRun[]): Promise<Set<string>> {
    const pinned = new Set<string>();
    for (const run of runs) {
      if (run.verification_status === VerificationStatus.VERIFYING) pinned.add(run.id);
    }

    const runIds = runs.map((run) => run.id);
    if (runIds.length > 0) {
      const activeRestores = await this.restoreRepo.find({
        where: { backup_run_id: In(runIds), status: In(ACTIVE_RESTORE_STATUSES) },
      });
      for (const request of activeRestores) pinned.add(request.backup_run_id);
    }

    return pinned;
  }

  private deferred(job: BackupJob, reason: string, metadata: Record<string, unknown> = {}): void {
    this.logger.operation({
      event: 'retention.cleanup.deferred',
      level: 'warn',
      message: reason,
      context: 'RetentionService',
      metadata: { job_id: job.id, retain_count: job.retention_full_count, ...metadata },
    });
  }

  /**
   * Deletion is only ever safe while a backup that is known to still be in object
   * storage remains. A database row claiming `verified` proves nothing about the
   * bytes, so the anchor is probed for exact-object presence before any candidate
   * is considered. Absence and uncertainty both defer the whole cleanup.
   */
  private async anchorIsProven(job: BackupJob, env: WalgEnv, anchor: BackupRun, objectName: string): Promise<boolean> {
    const probe = await this.walg.probeLogicalObject(env, objectName);
    if (probe.status === 'present') {
      this.logger.operation({
        event: 'retention.cleanup.anchor_verified',
        message: 'Retention confirmed the verified safety anchor is present in object storage',
        context: 'RetentionService',
        metadata: { job_id: job.id, run_id: anchor.id, object_size: probe.size },
      });
      return true;
    }

    this.deferred(
      job,
      'Retention cleanup deferred because the verified safety anchor could not be proven present in object storage',
      { run_id: anchor.id, anchor_probe: probe.status },
    );
    return false;
  }

  /**
   * Final decision for one expired object, taken while the run's advisory lock is
   * held. Everything the decision depends on is re-read inside the lock - the run
   * row, its verification state, and any active restore referencing it - so a
   * restore that pins the run cannot slip in between the check and the delete.
   * The object is removed and the storage path cleared in the same locked
   * transaction, so a restore either sees the pin honoured or sees no path at all.
   */
  private async deleteExpiredObject(
    env: WalgEnv,
    run: BackupRun,
    objectName: string,
    manager: EntityManager,
  ): Promise<CandidateOutcome> {
    const fresh = await manager.findOne(BackupRun, { where: { id: run.id } });
    if (!fresh) return 'failed';
    if (fresh.storage_path !== run.storage_path) return 'pinned';
    if (fresh.verification_status === VerificationStatus.VERIFYING) return 'pinned';

    const activeRestores = await manager.count(RestoreRequest, {
      where: { backup_run_id: run.id, status: In(ACTIVE_RESTORE_STATUSES) },
    });
    if (activeRestores > 0) return 'pinned';

    const result = await this.walg.deleteLogicalObject(env, objectName);
    if (result.exitCode !== 0) return 'failed';

    await manager.update(BackupRun, { id: run.id }, { storage_path: null });
    run.storage_path = null;
    return 'deleted';
  }

  async cleanup(job: BackupJob, env: WalgEnv): Promise<void> {
    this.logger.operation({
      event: 'retention.cleanup.started',
      message: 'Retention cleanup started',
      context: 'RetentionService',
      metadata: { job_id: job.id, retain_count: job.retention_full_count },
    });

    const runs = await this.runRepo.find({
      where: { job_id: job.id, status: BackupRunStatus.SUCCESS },
      order: { started_at: 'DESC' },
    });

    let newestVerified: BackupRun | undefined;
    let anchorObject = '';
    for (const run of runs) {
      if (run.verification_status !== VerificationStatus.VERIFIED) continue;
      const objectName = this.deterministicObject(env, run);
      if (objectName === null) continue;
      newestVerified = run;
      anchorObject = objectName;
      break;
    }

    if (!newestVerified) {
      this.deferred(
        job,
        'Retention cleanup deferred until a verified backup with an intact deterministic object is available',
      );
      return;
    }

    if (!(await this.anchorIsProven(job, env, newestVerified, anchorObject))) return;

    const retainedIds = new Set(runs.slice(0, job.retention_full_count).map((run) => run.id));
    retainedIds.add(newestVerified.id);
    const candidates = runs.filter((run) => !retainedIds.has(run.id) && run.storage_path);
    const pinned = await this.pinnedRunIds(runs);
    const failures: string[] = [];
    let deletedCount = 0;
    let pinnedCount = 0;

    for (const run of candidates) {
      if (pinned.has(run.id)) {
        pinnedCount += 1;
        this.logger.operation({
          event: 'retention.cleanup.object_pinned',
          message: 'Retention kept an object referenced by an active restore or in-flight verification',
          context: 'RetentionService',
          metadata: { job_id: job.id, run_id: run.id, verification_status: run.verification_status },
        });
        continue;
      }

      const objectName = this.deterministicObject(env, run);
      if (!objectName) {
        failures.push(run.id);
        this.logger.operation({
          event: 'retention.cleanup.object_skipped',
          level: 'warn',
          message: 'Retention skipped a run whose storage path is not its exact deterministic object',
          context: 'RetentionService',
          metadata: { job_id: job.id, run_id: run.id },
        });
        continue;
      }

      let outcome: CandidateOutcome;
      try {
        outcome = await this.runLock.withBackupRunLock(run.id, (manager) =>
          this.deleteExpiredObject(env, run, objectName, manager));
      } catch (error) {
        outcome = 'failed';
        this.logger.operation({
          event: 'retention.cleanup.lock_unavailable',
          level: 'warn',
          message: isLockTimeout(error)
            ? 'Retention deferred an object because the backup run lock was held by an in-flight restore'
            : 'Retention deferred an object because the backup run lock could not be taken',
          context: 'RetentionService',
          metadata: { job_id: job.id, run_id: run.id },
        });
      }

      if (outcome === 'deleted') {
        deletedCount += 1;
        continue;
      }
      if (outcome === 'pinned') {
        pinnedCount += 1;
        this.logger.operation({
          event: 'retention.cleanup.object_pinned',
          message: 'Retention kept an object that a locked recheck found referenced by an active restore or verification',
          context: 'RetentionService',
          metadata: { job_id: job.id, run_id: run.id, recheck: 'locked' },
        });
        continue;
      }
      failures.push(run.id);
    }

    if (failures.length === 0) {
      this.logger.operation({
        event: 'retention.cleanup.succeeded',
        message: 'Retention cleanup completed',
        context: 'RetentionService',
        metadata: {
          job_id: job.id,
          retain_count: job.retention_full_count,
          deleted_count: deletedCount,
          pinned_count: pinnedCount,
        },
      });
      await this.notifications.retentionCleanupSucceeded(job.name, {
        job_id: job.id,
        retain_count: job.retention_full_count,
      });
      return;
    }

    this.logger.operation({
      event: 'retention.cleanup.failed',
      level: 'warn',
      message: 'Retention cleanup failed for one or more logical backup objects',
      context: 'RetentionService',
      metadata: {
        job_id: job.id,
        retain_count: job.retention_full_count,
        failed_count: failures.length,
        deleted_count: deletedCount,
        pinned_count: pinnedCount,
      },
    });
    await this.notifications.retentionCleanupFailed(job.name, {
      job_id: job.id,
      retain_count: job.retention_full_count,
      error: `Failed to remove ${failures.length} expired backup object(s).`,
    });
  }
}
