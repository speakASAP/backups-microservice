import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerRegistry, CronExpression } from '@nestjs/schedule';
// Use the CronJob from @nestjs/schedule's own bundled cron to avoid version mismatch
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CronJob } = require('@nestjs/schedule/node_modules/cron');
import {
  BackupRun,
  BackupRunStatus,
  TriggerType,
  VerificationStatus,
} from './entities/backup-run.entity';
import { BackupJob } from '../jobs/entities/backup-job.entity';
import { JobsService } from '../jobs/jobs.service';
import { WalgWrapperService } from './walg-wrapper.service';
import { RetentionService } from '../retention/retention.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-event.entity';
import { LoggerService } from '../../shared/logger/logger.service';
import { NightlyBackupBootstrapService } from './nightly-backup-bootstrap.service';

@Injectable()
export class BackupService implements OnModuleInit {
  constructor(
    @InjectRepository(BackupRun) private runRepo: Repository<BackupRun>,
    @InjectRepository(BackupJob) private jobRepo: Repository<BackupJob>,
    private jobsService: JobsService,
    private walg: WalgWrapperService,
    private retention: RetentionService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private logger: LoggerService,
    private schedulerRegistry: SchedulerRegistry,
    private nightlyBootstrap: NightlyBackupBootstrapService,
  ) {}

  async onModuleInit() {
    await this.nightlyBootstrap.ensureDefaultNightlyJob();
    const jobs = await this.jobsService.findEnabled();
    for (const job of jobs) {
      this.registerCron(job);
    }
    this.logger.log(`Registered ${jobs.length} backup cron jobs`, 'BackupService');
  }

  registerCron(job: BackupJob) {
    const cronName = `backup-job-${job.id}`;
    try { this.schedulerRegistry.deleteCronJob(cronName); } catch {}

    const cron = new CronJob(job.schedule_cron, () => {
      this.executeJob(job.id, TriggerType.SCHEDULER, 'scheduler').catch((err) =>
        this.logger.error(`Cron error job=${job.id}: ${err}`, err.stack, 'BackupService'),
      );
    });
    this.schedulerRegistry.addCronJob(cronName, cron);
    cron.start();
  }

  async triggerManual(jobId: string, actor = 'unknown'): Promise<BackupRun> {
    return this.executeJob(jobId, TriggerType.MANUAL, actor);
  }

  async executeJob(jobId: string, triggeredBy: TriggerType, triggeredActor = 'scheduler'): Promise<BackupRun> {
    const job = await this.jobsService.findOne(jobId);
    const run = await this.runRepo.save(
      this.runRepo.create({
        job_id: jobId,
        status: BackupRunStatus.RUNNING,
        verification_status: VerificationStatus.PENDING,
        verification_reason: 'Backup is still running; restore verification has not started.',
        triggered_by: triggeredBy,
        started_at: new Date(),
        storage_path: `${job.storage_prefix || job.target?.database_name}/${new Date().toISOString()}`,
      }),
    );

    if (triggeredBy === TriggerType.MANUAL) {
      await this.audit.record({
        action: AuditAction.MANUAL_BACKUP_TRIGGERED,
        actor: triggeredActor || 'unknown',
        target_id: job.target_id,
        job_id: job.id,
        backup_run_id: run.id,
        reason: 'Manual backup trigger requested.',
      });
    }

    this.logger.operation({
      event: 'backup.run.started',
      message: `Starting backup run for job ${job.name}`,
      context: 'BackupService',
      metadata: { job_id: job.id, run_id: run.id, trigger: triggeredBy },
    });

    const dbPassword = process.env.DB_PASSWORD || '';
    const env = this.walg.buildEnv(job, job.target, dbPassword);
    let output = '';

    const result = await this.walg.backupPush(env, (chunk) => { output += chunk; });

    run.walg_output = output;
    run.completed_at = new Date();

    if (result.exitCode === 0) {
      run.status = BackupRunStatus.SUCCESS;
      this.markVerificationPending(run, 'No isolated restore verification runner is configured yet.');
      await this.runRepo.save(run);
      await this.jobsService.updateLastRunAt(jobId);

      const durationSec = Math.round((run.completed_at.getTime() - run.started_at.getTime()) / 1000);
      await this.notifications.backupSucceeded(job.name, {
        job_id: job.id,
        run_id: run.id,
        duration_sec: durationSec,
      });
      await this.notifications.verificationPending(job.name, {
        job_id: job.id,
        run_id: run.id,
        verification_status: run.verification_status,
        reason: run.verification_reason,
      });

      this.logger.operation({
        event: 'backup.run.succeeded',
        message: `Backup run completed for job ${job.name}`,
        context: 'BackupService',
        metadata: {
          job_id: job.id,
          run_id: run.id,
          duration_sec: durationSec,
          verification_status: run.verification_status,
        },
      });

      await this.retention.cleanup(job, env);
    } else {
      run.status = BackupRunStatus.FAILED;
      run.error_message = output.slice(-500);
      this.markVerificationSkipped(run, 'Backup failed before restore verification could run.');
      await this.runRepo.save(run);

      await this.notifications.backupFailed(job.name, {
        job_id: job.id,
        run_id: run.id,
        error: run.error_message,
      });
      this.logger.operation({
        event: 'backup.run.failed',
        level: 'error',
        message: `Backup run failed for job ${job.name}`,
        context: 'BackupService',
        metadata: {
          job_id: job.id,
          run_id: run.id,
          error: run.error_message,
        },
      });
    }

    return run;
  }

  public toPublicRun(run: BackupRun): Record<string, unknown> {
    const { storage_path, walg_output, ...publicRun } = run as BackupRun & {
      storage_path?: string;
      walg_output?: string;
    };
    return publicRun;
  }

  findAll(jobId?: string, status?: string, limit = 20, offset = 0): Promise<BackupRun[]> {
    const where: Record<string, unknown> = {};
    if (jobId) where.job_id = jobId;
    if (status) where.status = status;
    return this.runRepo.find({ where, order: { started_at: 'DESC' }, take: limit, skip: offset, relations: ['job'] });
  }

  async findOne(id: string): Promise<BackupRun> {
    const run = await this.runRepo.findOne({ where: { id }, relations: ['job'] });
    if (!run) throw new Error(`BackupRun ${id} not found`);
    return run;
  }

  async remove(
    id: string,
    actor = 'unknown',
    dto: { approval_actor?: string; approval_reason?: string } = {},
  ): Promise<Record<string, string>> {
    const run = await this.findOne(id);
    const approvalActor = dto.approval_actor?.trim();
    const approvalReason = dto.approval_reason?.trim();
    if (!approvalActor || !approvalReason) {
      throw new BadRequestException('Backup-run deletion is disabled unless approval actor and audit reason are supplied.');
    }

    await this.audit.record({
      action: AuditAction.BACKUP_RUN_DELETION_BLOCKED,
      actor: actor || 'unknown',
      target_id: run.job?.target_id,
      job_id: run.job_id,
      backup_run_id: run.id,
      reason: approvalReason,
      metadata: { status: run.status, physical_delete: false, approved_by: approvalActor },
    });
    this.logger.operation({
      event: 'backup.run.delete.blocked',
      level: 'warn',
      message: 'Backup run deletion blocked',
      context: 'BackupService',
      metadata: {
        actor: actor || 'unknown',
        approved_by: approvalActor,
        job_id: run.job_id,
        run_id: run.id,
        status: run.status,
      },
    });
    return {
      status: 'blocked',
      backup_run_id: run.id,
      message: 'Physical backup-run deletion is disabled; approval request was recorded for audit.',
    };
  }

  private markVerificationPending(run: BackupRun, reason: string) {
    run.verification_status = VerificationStatus.PENDING;
    run.verification_checked_at = new Date();
    run.verification_reason = reason;
    run.verification_error = null;
  }

  private markVerificationSkipped(run: BackupRun, reason: string) {
    run.verification_status = VerificationStatus.SKIPPED;
    run.verification_checked_at = new Date();
    run.verification_reason = reason;
    run.verification_error = null;
  }
}
