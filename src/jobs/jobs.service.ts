import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupJob } from './entities/backup-job.entity';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { BackupTarget, SourceCategory } from '../targets/entities/backup-target.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-event.entity';
import { LoggerService } from '../../shared/logger/logger.service';
import { resolveSchedulePolicy } from './schedule-policy';

const MIN_SAFE_FULL_BACKUPS = 3;

function normalized(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requireLowRetentionApproval(retentionFullCount: number, actor?: string, reason?: string): void {
  if (retentionFullCount >= MIN_SAFE_FULL_BACKUPS) return;
  if (!normalized(actor) || normalized(reason).length < 12) {
    throw new BadRequestException('Retention below three full backups requires explicit owner approval actor and reason.');
  }
}

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(BackupJob) private repo: Repository<BackupJob>,
    @InjectRepository(BackupTarget) private targetRepo: Repository<BackupTarget>,
    private audit: AuditService,
    private logger: LoggerService,
  ) {}

  findAll(): Promise<BackupJob[]> {
    return this.repo.find({ relations: ['target'], order: { created_at: 'DESC' } });
  }

  async findOne(id: string): Promise<BackupJob> {
    const job = await this.repo.findOne({ where: { id }, relations: ['target'] });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  findEnabled(): Promise<BackupJob[]> {
    return this.repo.find({ where: { enabled: true }, relations: ['target'] });
  }

  async create(dto: CreateJobDto, actor = 'unknown'): Promise<BackupJob> {
    const target = await this.targetRepo.findOne({ where: { id: dto.target_id } });
    if (!target) throw new NotFoundException(`Target ${dto.target_id} not found`);

    if ((target.source_category || SourceCategory.POSTGRES_DATABASE) !== SourceCategory.POSTGRES_DATABASE) {
      throw new BadRequestException('Backup jobs are only implemented for postgres_database targets; this source category is contract-only.');
    }

    const retentionFullCount = dto.retention_full_count ?? 7;
    requireLowRetentionApproval(retentionFullCount, dto.retention_approval_actor, dto.retention_approval_reason);
    const schedule = resolveSchedulePolicy(dto);

    const job = this.repo.create({
      ...dto,
      ...schedule,
      retention_full_count: retentionFullCount,
      retention_approval_actor: retentionFullCount < MIN_SAFE_FULL_BACKUPS ? normalized(dto.retention_approval_actor) : null,
      retention_approval_reason: retentionFullCount < MIN_SAFE_FULL_BACKUPS ? normalized(dto.retention_approval_reason) : null,
      retention_approved_at: retentionFullCount < MIN_SAFE_FULL_BACKUPS ? new Date() : null,
      enabled: dto.enabled ?? true,
    });
    const saved = await this.repo.save(job);
    this.logger.operation({
      event: 'backup.job.created',
      message: `Backup job created: ${saved.name}`,
      context: 'JobsService',
      metadata: {
        job_id: saved.id,
        target_id: saved.target_id,
        retention_full_count: saved.retention_full_count,
        schedule_policy: saved.schedule_policy,
        actor,
      },
    });
    if (saved.retention_full_count < MIN_SAFE_FULL_BACKUPS) {
      await this.audit.record({
        action: AuditAction.RETENTION_APPROVAL,
        actor: actor || saved.retention_approval_actor,
        target_id: saved.target_id,
        job_id: saved.id,
        reason: saved.retention_approval_reason,
        metadata: {
          retention_full_count: saved.retention_full_count,
          approval_actor: saved.retention_approval_actor,
        },
      });
    }
    return saved;
  }

  async update(id: string, dto: UpdateJobDto, actor = 'unknown'): Promise<BackupJob> {
    const job = await this.findOne(id);
    const nextRetention = dto.retention_full_count ?? job.retention_full_count;
    const approvalActor = normalized(dto.retention_approval_actor || job.retention_approval_actor);
    const approvalReason = normalized(dto.retention_approval_reason || job.retention_approval_reason);
    requireLowRetentionApproval(nextRetention, approvalActor, approvalReason);

    const previousRetention = job.retention_full_count;
    const previousSchedule = {
      schedule_cron: job.schedule_cron,
      schedule_policy: job.schedule_policy,
      schedule_hour_utc: job.schedule_hour_utc,
      schedule_minute_utc: job.schedule_minute_utc,
      schedule_day_of_week: job.schedule_day_of_week,
    };
    const scheduleInput = { ...previousSchedule, ...dto };
    const schedule = resolveSchedulePolicy(scheduleInput);
    Object.assign(job, dto, schedule);
    if (nextRetention < MIN_SAFE_FULL_BACKUPS) {
      job.retention_approval_actor = approvalActor;
      job.retention_approval_reason = approvalReason;
      job.retention_approved_at = dto.retention_approval_actor || dto.retention_approval_reason || !job.retention_approved_at
        ? new Date()
        : job.retention_approved_at;
    } else {
      job.retention_approval_actor = null;
      job.retention_approval_reason = null;
      job.retention_approved_at = null;
    }

    const saved = await this.repo.save(job);
    this.logger.operation({
      event: 'backup.job.updated',
      message: `Backup job updated: ${saved.name}`,
      context: 'JobsService',
      metadata: {
        job_id: saved.id,
        target_id: saved.target_id,
        previous_retention_full_count: previousRetention,
        retention_full_count: saved.retention_full_count,
        schedule_policy: saved.schedule_policy,
        actor,
      },
    });
    if (saved.retention_full_count !== previousRetention || saved.retention_full_count < MIN_SAFE_FULL_BACKUPS) {
      await this.audit.record({
        action: saved.retention_full_count < MIN_SAFE_FULL_BACKUPS
          ? AuditAction.RETENTION_APPROVAL
          : AuditAction.RETENTION_POLICY_UPDATE,
        actor: actor || approvalActor || 'unknown',
        target_id: saved.target_id,
        job_id: saved.id,
        reason: saved.retention_full_count < MIN_SAFE_FULL_BACKUPS
          ? saved.retention_approval_reason
          : `Retention changed from ${previousRetention} to ${saved.retention_full_count} full backups.`,
        metadata: {
          previous_retention_full_count: previousRetention,
          retention_full_count: saved.retention_full_count,
          approval_actor: saved.retention_approval_actor,
        },
      });
    }
    return saved;
  }

  async remove(id: string): Promise<void> {
    const job = await this.findOne(id);
    job.enabled = false;
    await this.repo.save(job);
    this.logger.operation({
      event: 'backup.job.disabled',
      level: 'warn',
      message: `Backup job disabled: ${job.name}`,
      context: 'JobsService',
      metadata: { job_id: job.id, target_id: job.target_id },
    });
  }

  async updateLastRunAt(id: string): Promise<void> {
    await this.repo.update(id, { last_run_at: new Date() });
  }
}
