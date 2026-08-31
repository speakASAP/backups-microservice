import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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

  /**
   * Records an audit event, optionally on a caller-supplied transactional manager.
   *
   * Passing the manager lets a caller make the audit trail and the state change it
   * describes atomic: either both are durable, or neither is. That is what stops an
   * audit failure from leaving behind a state row nobody can explain - or, for
   * restore requests, a pending row that permanently blocks its target.
   */
  async record(input: AuditRecordInput, manager?: EntityManager): Promise<AuditEvent> {
    const repo = manager ? manager.getRepository(AuditEvent) : this.repo;
    const event = repo.create({
      action: input.action,
      actor: input.actor,
      reason: input.reason,
      target_id: input.target_id || null,
      job_id: input.job_id || null,
      backup_run_id: input.backup_run_id || null,
      restore_request_id: input.restore_request_id || null,
      metadata: input.metadata || null,
    });
    const saved = await repo.save(event);
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
