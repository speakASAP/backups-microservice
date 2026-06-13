import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditEvent } from './entities/audit-event.entity';
import { LoggerService } from '../../shared/logger/logger.service';

export interface AuditRecordInput {
  action: AuditAction;
  actor: string;
  reason: string;
  target_id?: string | null;
  job_id?: string | null;
  backup_run_id?: string | null;
  restore_request_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEvent) private repo: Repository<AuditEvent>,
    private logger: LoggerService,
  ) {}

  async record(input: AuditRecordInput): Promise<AuditEvent> {
    const event = this.repo.create({
      action: input.action,
      actor: input.actor,
      reason: input.reason,
      target_id: input.target_id || null,
      job_id: input.job_id || null,
      backup_run_id: input.backup_run_id || null,
      restore_request_id: input.restore_request_id || null,
      metadata: input.metadata || null,
    });
    const saved = await this.repo.save(event);
    this.logger.operation({
      event: 'audit.event.recorded',
      message: `Audit event recorded: ${saved.action}`,
      context: 'AuditService',
      metadata: {
        audit_event_id: saved.id,
        action: saved.action,
        actor: saved.actor,
        target_id: saved.target_id,
        job_id: saved.job_id,
        backup_run_id: saved.backup_run_id,
        restore_request_id: saved.restore_request_id,
      },
    });
    return saved;
  }
}
