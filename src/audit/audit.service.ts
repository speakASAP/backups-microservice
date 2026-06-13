import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditEvent } from './entities/audit-event.entity';

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
  constructor(@InjectRepository(AuditEvent) private repo: Repository<AuditEvent>) {}

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
    return this.repo.save(event);
  }
}
