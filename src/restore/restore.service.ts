import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RestoreRequest, RestoreStatus } from "./entities/restore-request.entity";
import { CreateRestoreDto } from "./dto/create-restore.dto";
import { BackupService } from "../backup/backup.service";
import { TargetsService } from "../targets/targets.service";
import { WalgWrapperService } from "../backup/walg-wrapper.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditAction } from "../audit/audit-log.entity";
import { AuditService } from "../audit/audit.service";
import { LoggerService } from "../../shared/logger/logger.service";

@Injectable()
export class RestoreService {
  constructor(
    @InjectRepository(RestoreRequest) private repo: Repository<RestoreRequest>,
    private backupService: BackupService,
    private targetsService: TargetsService,
    private walg: WalgWrapperService,
    private notifications: NotificationsService,
    private audit: AuditService,
    private logger: LoggerService,
  ) {}

  findAll(): Promise<RestoreRequest[]> {
    return this.repo.find({ order: { created_at: "DESC" }, relations: ["backup_run", "target"] });
  }

  async findOne(id: string): Promise<RestoreRequest> {
    const req = await this.repo.findOne({ where: { id }, relations: ["backup_run", "target"] });
    if (!req) throw new Error(`RestoreRequest ${id} not found`);
    return req;
  }

  public toPublicRequest(request: RestoreRequest): Record<string, unknown> {
    const { walg_output, ...publicRequest } = request as RestoreRequest & { walg_output?: string };
    return publicRequest;
  }

  async create(dto: CreateRestoreDto, requestedBy: string): Promise<RestoreRequest> {
    const environment = dto.target_environment || "production";
    const approvalActor = dto.approval_actor?.trim();
    const approvalReason = dto.approval_reason?.trim();
    if (environment === "production" && (!dto.approval_confirmed || !approvalActor || !approvalReason)) {
      throw new BadRequestException("Production restore requires approval confirmation, approval actor, and reason.");
    }
    if (!approvalReason) throw new BadRequestException("Restore request requires an audit reason.");

    const backupRun = await this.backupService.findOne(dto.backup_run_id);
    const target = await this.targetsService.findOne(dto.target_id);
    if (backupRun.job?.target_id && backupRun.job.target_id !== target.id) {
      throw new BadRequestException("Restore target must match the selected backup run target.");
    }

    const request = await this.repo.save(
      this.repo.create({
        backup_run_id: dto.backup_run_id,
        target_id: dto.target_id,
        status: RestoreStatus.PENDING,
        requested_by: requestedBy,
        target_environment: environment,
        approval_actor: approvalActor || null,
        approval_reason: approvalReason,
        approval_confirmed: Boolean(dto.approval_confirmed),
        approval_recorded_at: approvalActor || approvalReason ? new Date() : null,
      }),
    );

    await this.audit.record({
      action: AuditAction.RESTORE_REQUESTED,
      actor: requestedBy,
      target_id: target.id,
      job_id: backupRun.job_id,
      backup_run_id: backupRun.id,
      restore_request_id: request.id,
      reason: approvalReason,
      metadata: { environment, approved_by: approvalActor || null },
    });

    this.executeRestore(request.id).catch((err) =>
      this.logger.error(`Restore execution error request=${request.id}: ${err.message}`, err.stack, "RestoreService"),
    );

    return request;
  }

  private async executeRestore(requestId: string): Promise<void> {
    const request = await this.findOne(requestId);
    const backupRun = await this.backupService.findOne(request.backup_run_id);
    const target = await this.targetsService.findOne(request.target_id);

    request.status = RestoreStatus.RUNNING;
    request.started_at = new Date();
    await this.repo.save(request);
    await this.audit.record({
      action: AuditAction.RESTORE_STARTED,
      actor: request.requested_by,
      target_id: target.id,
      job_id: backupRun.job_id,
      backup_run_id: backupRun.id,
      restore_request_id: request.id,
      reason: request.approval_reason,
      metadata: { environment: request.target_environment },
    });

    const env = this.walg.buildEnv(
      { storage_prefix: backupRun.storage_path || undefined },
      target,
      process.env.DB_PASSWORD || "",
    );

    let output = "";
    const result = await this.walg.run(
      ["pgbackup-fetch", "/tmp/restore", "LATEST"],
      env,
      (chunk) => { output += chunk; },
    );

    request.walg_output = output;
    request.completed_at = new Date();

    if (result.exitCode === 0) {
      request.status = RestoreStatus.COMPLETED;
      await this.repo.save(request);
      await this.notifications.send("restore.completed", `Restore completed for target: ${target.name}`, {
        request_id: request.id, backup_run_id: backupRun.id,
      });
      await this.audit.record({
        action: AuditAction.RESTORE_COMPLETED,
        actor: request.requested_by,
        target_id: target.id,
        job_id: backupRun.job_id,
        backup_run_id: backupRun.id,
        restore_request_id: request.id,
        reason: request.approval_reason,
        metadata: { environment: request.target_environment },
      });
    } else {
      request.status = RestoreStatus.FAILED;
      request.error_message = this.commandFailureSummary(output);
      await this.repo.save(request);
      await this.notifications.send("restore.failed", `Restore FAILED for target: ${target.name}`, {
        request_id: request.id, error: request.error_message,
      });
      await this.audit.record({
        action: AuditAction.RESTORE_FAILED,
        actor: request.requested_by,
        target_id: target.id,
        job_id: backupRun.job_id,
        backup_run_id: backupRun.id,
        restore_request_id: request.id,
        reason: request.approval_reason,
        metadata: { environment: request.target_environment },
      });
      this.logger.error(`Restore failed request=${request.id}`, request.error_message, "RestoreService");
    }
  }

  private commandFailureSummary(output: string): string {
    return `Restore command failed. Captured output length: ${output.length} characters.`;
  }
}
