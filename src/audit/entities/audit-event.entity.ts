import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AuditAction {
  MANUAL_BACKUP_TRIGGERED = 'manual_backup_triggered',
  RETENTION_APPROVAL = 'retention_approval',
  RETENTION_POLICY_UPDATE = 'retention_policy_update',
  BACKUP_RUN_DELETE_DENIED = 'backup_run_delete_denied',
  BACKUP_RUN_DELETION_BLOCKED = 'backup_run_deletion_blocked',
  RESTORE_REQUEST_CREATED = 'restore_request_created',
  RESTORE_EXECUTION_COMPLETED = 'restore_execution_completed',
  RESTORE_EXECUTION_FAILED = 'restore_execution_failed',
}

@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 80 }) action: AuditAction;
  @Column({ type: 'varchar', length: 255 }) actor: string;
  @Column({ type: 'uuid', nullable: true }) target_id: string;
  @Column({ type: 'uuid', nullable: true }) job_id: string;
  @Column({ type: 'uuid', nullable: true }) backup_run_id: string;
  @Column({ type: 'uuid', nullable: true }) restore_request_id: string;
  @Column({ type: 'text' }) reason: string;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown> | null;
  @CreateDateColumn() created_at: Date;
}
