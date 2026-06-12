import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BackupJob } from "./entities/backup-job.entity";
import { CreateJobDto } from "./dto/create-job.dto";
import { UpdateJobDto } from "./dto/update-job.dto";
import { AuditAction } from "../audit/audit-log.entity";
import { AuditService } from "../audit/audit.service";

const MIN_SAFE_FULL_BACKUPS = 3;

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(BackupJob) private repo: Repository<BackupJob>,
    private audit: AuditService,
  ) {}

  findAll(): Promise<BackupJob[]> {
    return this.repo.find({ relations: ["target"], order: { created_at: "DESC" } });
  }

  async findOne(id: string): Promise<BackupJob> {
    const job = await this.repo.findOne({ where: { id }, relations: ["target"] });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  findEnabled(): Promise<BackupJob[]> {
    return this.repo.find({ where: { enabled: true }, relations: ["target"] });
  }

  async create(dto: CreateJobDto, actor = "unknown"): Promise<BackupJob> {
    const retention = dto.retention_full_count ?? 7;
    const approval = this.requireRetentionApproval(retention, dto.retention_approval_actor, dto.retention_approval_reason);
    const job = this.repo.create({
      ...dto,
      retention_full_count: retention,
      retention_approval_actor: approval?.actor || null,
      retention_approval_reason: approval?.reason || null,
      retention_approved_at: approval ? new Date() : null,
      enabled: dto.enabled ?? true,
    });
    const saved = await this.repo.save(job);
    if (approval) await this.auditRetentionApproval(saved, actor, approval.reason);
    return saved;
  }

  async update(id: string, dto: UpdateJobDto, actor = "unknown"): Promise<BackupJob> {
    const job = await this.findOne(id);
    const retention = dto.retention_full_count ?? job.retention_full_count;
    const approvalActor = dto.retention_approval_actor ?? job.retention_approval_actor;
    const approvalReason = dto.retention_approval_reason ?? job.retention_approval_reason;
    const approval = this.requireRetentionApproval(retention, approvalActor, approvalReason);

    Object.assign(job, dto);
    job.retention_full_count = retention;
    if (approval) {
      job.retention_approval_actor = approval.actor;
      job.retention_approval_reason = approval.reason;
      job.retention_approved_at = dto.retention_approval_actor || dto.retention_approval_reason || !job.retention_approved_at
        ? new Date()
        : job.retention_approved_at;
    } else if (retention >= MIN_SAFE_FULL_BACKUPS) {
      job.retention_approval_actor = null;
      job.retention_approval_reason = null;
      job.retention_approved_at = null;
    }

    const saved = await this.repo.save(job);
    if (approval && retention < MIN_SAFE_FULL_BACKUPS) await this.auditRetentionApproval(saved, actor, approval.reason);
    return saved;
  }

  async remove(id: string, actor = "unknown"): Promise<void> {
    const job = await this.findOne(id);
    job.enabled = false;
    await this.repo.save(job);
    await this.audit.record({
      action: "backup_job_disabled",
      actor,
      target_id: job.target_id,
      job_id: job.id,
      reason: "Job disabled through management API instead of deleting schedule evidence.",
    });
  }

  async updateLastRunAt(id: string): Promise<void> {
    await this.repo.update(id, { last_run_at: new Date() });
  }

  private requireRetentionApproval(retention: number, actor?: string, reason?: string): { actor: string; reason: string } | null {
    if (retention >= MIN_SAFE_FULL_BACKUPS) return null;
    const trimmedActor = actor?.trim();
    const trimmedReason = reason?.trim();
    if (!trimmedActor || !trimmedReason) {
      throw new BadRequestException("Retention below three full backups requires approval actor and reason.");
    }
    return { actor: trimmedActor, reason: trimmedReason };
  }

  private async auditRetentionApproval(job: BackupJob, actor: string, reason: string): Promise<void> {
    await this.audit.record({
      action: AuditAction.RETENTION_POLICY_APPROVED,
      actor,
      target_id: job.target_id,
      job_id: job.id,
      reason,
      metadata: {
        retain_count: job.retention_full_count,
        approved_by: job.retention_approval_actor,
      },
    });
  }
}
