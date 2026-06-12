import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { BackupJob } from '../../jobs/entities/backup-job.entity';

export enum BackupRunStatus { RUNNING = 'running', SUCCESS = 'success', FAILED = 'failed', VERIFYING = 'verifying' }
export enum VerificationStatus {
  UNKNOWN = 'unknown',
  PENDING = 'pending',
  VERIFYING = 'verifying',
  VERIFIED = 'verified',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}
export enum TriggerType { SCHEDULER = 'scheduler', MANUAL = 'manual' }

@Entity('backup_runs')
export class BackupRun {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) job_id: string;
  @ManyToOne(() => BackupJob) @JoinColumn({ name: 'job_id' }) job: BackupJob;
  @Column({ type: 'varchar', length: 20, default: 'running' }) status: BackupRunStatus;
  @Column({ type: 'timestamptz', default: () => 'NOW()' }) started_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) completed_at: Date;
  @Column({ type: 'bigint', nullable: true }) size_bytes: number;
  @Column({ type: 'varchar', length: 500, nullable: true }) storage_path: string;
  @Column({ type: 'text', nullable: true }) walg_output: string;
  @Column({ type: 'text', nullable: true }) error_message: string;
  @Column({ type: 'varchar', length: 20, default: 'unknown' }) verification_status: VerificationStatus;
  @Column({ type: 'timestamptz', nullable: true }) verification_checked_at: Date;
  @Column({ type: 'varchar', length: 255, nullable: true }) verification_reason: string;
  @Column({ type: 'text', nullable: true }) verification_error: string;
  @Column({ type: 'varchar', length: 20, default: 'scheduler' }) triggered_by: TriggerType;
  @CreateDateColumn() created_at: Date;
}
