import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from './audit-log.entity';
import { LoggerService } from '../../shared/logger/logger.service';

export interface AuditRecordInput {
  action: AuditAction | string;
  actor?: string;
  target_id?: string;
  job_id?: string;
  backup_run_id?: string;
  restore_request_id?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private repo: Repository<AuditLog>,
    private logger: LoggerService,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    const log = this.repo.create({
      action: input.action,
      actor: input.actor || 'unknown',
      target_id: input.target_id || null,
      job_id: input.job_id || null,
      backup_run_id: input.backup_run_id || null,
      restore_request_id: input.restore_request_id || null,
      reason: input.reason || null,
      metadata: input.metadata || null,
    });

    try {
      await this.repo.save(log);
      this.logger.log(
        `audit action=${log.action} actor=${log.actor} target=${log.target_id || '-'} job=${log.job_id || '-'} run=${log.backup_run_id || '-'} restore=${log.restore_request_id || '-'}`,
        'AuditService',
      );
    } catch (error) {
      this.logger.warn(`Audit log write failed for action=${input.action}: ${(error as Error).message}`, 'AuditService');
    }
  }
}
