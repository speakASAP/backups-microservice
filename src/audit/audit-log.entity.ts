import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum AuditAction {
  MANUAL_BACKUP_TRIGGERED = 'manual_backup_triggered',
  RETENTION_POLICY_APPROVED = 'retention_policy_approved',
  BACKUP_RUN_DELETION_BLOCKED = 'backup_run_deletion_blocked',
  RESTORE_REQUESTED = 'restore_requested',
  RESTORE_STARTED = 'restore_started',
  RESTORE_COMPLETED = 'restore_completed',
  RESTORE_FAILED = 'restore_failed',
}

@Entity('backup_audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 80 }) action: AuditAction | string;
  @Column({ type: 'varchar', length: 255, nullable: true }) actor: string;
  @Column({ type: 'uuid', nullable: true }) target_id: string;
  @Column({ type: 'uuid', nullable: true }) job_id: string;
  @Column({ type: 'uuid', nullable: true }) backup_run_id: string;
  @Column({ type: 'uuid', nullable: true }) restore_request_id: string;
  @Column({ type: 'text', nullable: true }) reason: string;
  @Column({ type: 'jsonb', nullable: true }) metadata: Record<string, unknown>;
  @CreateDateColumn() created_at: Date;
}
