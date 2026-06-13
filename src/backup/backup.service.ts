import { Injectable, MethodNotAllowedException, OnModuleInit } from '@nestjs/common';
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
  ) {}

  async onModuleInit() {
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
      this.executeJob(job.id, TriggerType.SCHEDULER).catch((err) =>
        this.logger.error(`Cron error job=${job.id}: ${err}`, err.stack, 'BackupService'),
      );
    });
    this.schedulerRegistry.addCronJob(cronName, cron);
    cron.start();
  }

  async triggerManual(jobId: string): Promise<BackupRun> {
    return this.executeJob(jobId, TriggerType.MANUAL);
  }

  async executeJob(jobId: string, triggeredBy: TriggerType): Promise<BackupRun> {
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

    this.logger.log(`Starting backup run=${run.id} job=${job.name}`, 'BackupService');

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
      await this.notifications.send('backup.success', `Backup successful: ${job.name}`, {
        job_id: job.id, run_id: run.id, duration_sec: durationSec,
      });
      await this.notifications.send('backup.verification.pending', `Restore verification pending: ${job.name}`, {
        job_id: job.id,
        run_id: run.id,
        verification_status: run.verification_status,
        reason: run.verification_reason,
      });

      await this.retention.cleanup(job, env);
    } else {
      run.status = BackupRunStatus.FAILED;
      run.error_message = output.slice(-500);
      this.markVerificationSkipped(run, 'Backup failed before restore verification could run.');
      await this.runRepo.save(run);

      await this.notifications.send('backup.failure', `Backup FAILED: ${job.name}`, {
        job_id: job.id, run_id: run.id, error: run.error_message,
      });
      this.logger.error(`Backup failed job=${job.id} run=${run.id}`, output, 'BackupService');
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

  async remove(id: string, actor = 'unknown', reason?: string): Promise<void> {
    const run = await this.findOne(id);
    const auditReason = reason?.trim() || 'Backup run deletion denied because backup-run deletion is disabled.';
    await this.audit.record({
      action: AuditAction.BACKUP_RUN_DELETE_DENIED,
      actor: actor || 'unknown',
      target_id: run.job?.target_id,
      job_id: run.job_id,
      backup_run_id: run.id,
      reason: auditReason,
      metadata: { status: run.status },
    });
    throw new MethodNotAllowedException('Backup run deletion is disabled. Preserve backup evidence or request owner-approved retention policy changes instead.');
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
