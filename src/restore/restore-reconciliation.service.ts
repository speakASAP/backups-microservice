import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RestoreRequest, RestoreStatus } from './entities/restore-request.entity';
import { RestoreService, ACTIVE_RESTORE_STATUSES } from './restore.service';
import { LoggerService } from '../../shared/logger/logger.service';

export const RECONCILE_INTERVAL_MS = 60_000;
export const DEFAULT_PENDING_ADOPT_MS = 60_000;
export const DEFAULT_PENDING_ABANDON_MS = 6 * 60 * 60 * 1_000;
export const DEFAULT_RUNNING_STALE_MS = 2 * 60 * 60 * 1_000;

export interface RestoreReconciliationSummary {
  inspected: number;
  redispatched: number;
  abandoned: number;
  interrupted: number;
  skipped: number;
}

function envMs(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function ageMs(request: RestoreRequest, now: Date): number {
  const basis = request.status === RestoreStatus.RUNNING
    ? request.started_at || request.created_at
    : request.created_at;
  const timestamp = basis ? new Date(basis).getTime() : NaN;
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return now.getTime() - timestamp;
}

/**
 * Restart-safe recovery for restore requests nothing is driving any more.
 *
 * A restore request is a pin: while it is pending or running it occupies the
 * target's single active-restore slot and holds the backup object against
 * retention. Execution is dispatched in-process, so a crash, a rollout, or an
 * OOM kill between "request saved" and "request finished" would otherwise leave
 * that pin forever, and no operator could ever restore that target again.
 *
 * The reconciler resolves every stranded request into either execution or an
 * explicit terminal failure, and never into a silent second destructive run:
 * pending requests are re-dispatched through the same conditional claim that
 * makes execution once-only, pending requests older than the abandon window and
 * running requests older than the stale window are failed terminally with audit
 * evidence, and anything this process is actively executing is left alone.
 */
@Injectable()
export class RestoreReconciliationService {
  constructor(
    @InjectRepository(RestoreRequest) private repo: Repository<RestoreRequest>,
    private restore: RestoreService,
    private logger: LoggerService,
  ) {}

  @Interval('restore-request-reconciliation', RECONCILE_INTERVAL_MS)
  async scheduledReconcile(): Promise<void> {
    try {
      await this.reconcile();
    } catch (error) {
      this.logger.error(
        `Restore reconciliation failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        error instanceof Error ? error.stack : undefined,
        'RestoreReconciliationService',
      );
    }
  }

  async reconcile(now: Date = new Date()): Promise<RestoreReconciliationSummary> {
    const adoptAfter = envMs('RESTORE_PENDING_ADOPT_MS', DEFAULT_PENDING_ADOPT_MS);
    const abandonAfter = envMs('RESTORE_PENDING_ABANDON_MS', DEFAULT_PENDING_ABANDON_MS);
    const staleAfter = envMs('RESTORE_RUNNING_STALE_MS', DEFAULT_RUNNING_STALE_MS);

    const stranded = await this.repo.find({ where: { status: In(ACTIVE_RESTORE_STATUSES) } });
    const summary: RestoreReconciliationSummary = {
      inspected: stranded.length,
      redispatched: 0,
      abandoned: 0,
      interrupted: 0,
      skipped: 0,
    };

    for (const request of stranded) {
      if (this.restore.isInFlight(request.id)) {
        summary.skipped += 1;
        continue;
      }

      const age = ageMs(request, now);

      if (request.status === RestoreStatus.RUNNING) {
        if (age < staleAfter) {
          summary.skipped += 1;
          continue;
        }
        const failed = await this.restore.terminateStaleRequest(
          request.id,
          RestoreStatus.RUNNING,
          'Restore execution was interrupted before it reported an outcome. The single-transaction pg_restore rolled back; request a new restore to retry.',
        );
        if (failed) summary.interrupted += 1;
        else summary.skipped += 1;
        continue;
      }

      if (age < adoptAfter) {
        summary.skipped += 1;
        continue;
      }

      if (age >= abandonAfter) {
        const failed = await this.restore.terminateStaleRequest(
          request.id,
          RestoreStatus.PENDING,
          'Restore approval expired before execution started. Request a new approved restore to retry.',
        );
        if (failed) summary.abandoned += 1;
        else summary.skipped += 1;
        continue;
      }

      this.logger.operation({
        event: 'restore.reconcile.redispatched',
        level: 'warn',
        message: 'Restore request was still pending with no live execution and was re-dispatched',
        context: 'RestoreReconciliationService',
        metadata: {
          request_id: request.id,
          target_id: request.target_id,
          backup_run_id: request.backup_run_id,
          pending_for_ms: Number.isFinite(age) ? age : null,
        },
      });
      summary.redispatched += 1;
      this.restore.resumeExecution(request.id).catch((error) =>
        this.logger.error(
          `Re-dispatched restore execution failed: ${error instanceof Error ? error.message : 'unknown error'}`,
          error instanceof Error ? error.stack : undefined,
          'RestoreReconciliationService',
        ),
      );
    }

    if (summary.redispatched > 0 || summary.abandoned > 0 || summary.interrupted > 0) {
      this.logger.operation({
        event: 'restore.reconcile.completed',
        level: 'warn',
        message: 'Restore reconciliation resolved stranded restore requests',
        context: 'RestoreReconciliationService',
        metadata: { ...summary },
      });
    }

    return summary;
  }
}
