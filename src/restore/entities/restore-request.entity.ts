import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { BackupRun } from '../../backup/entities/backup-run.entity';
import { BackupTarget } from '../../targets/entities/backup-target.entity';

export enum RestoreStatus { PENDING = 'pending', RUNNING = 'running', COMPLETED = 'completed', FAILED = 'failed' }

@Entity('restore_requests')
export class RestoreRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) backup_run_id: string;
  @ManyToOne(() => BackupRun) @JoinColumn({ name: 'backup_run_id' }) backup_run: BackupRun;
  @Column({ type: 'uuid' }) target_id: string;
  @ManyToOne(() => BackupTarget) @JoinColumn({ name: 'target_id' }) target: BackupTarget;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: RestoreStatus;
  @Column({ type: 'varchar', length: 255, nullable: true }) requested_by: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) approval_actor: string;
  @Column({ type: 'text', nullable: true }) approval_reason: string;
  @Column({ type: 'uuid', nullable: true }) approval_confirmed_target_id: string;
  @Column({ type: 'uuid', nullable: true }) approval_confirmed_backup_run_id: string;
  @Column({ type: 'boolean', default: false }) production_restore_approved: boolean;
  @Column({ type: 'timestamptz', nullable: true }) approved_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) started_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) completed_at: Date;
  @Column({ type: 'text', nullable: true }) error_message: string;
  @Column({ type: 'text', nullable: true }) walg_output: string;
  @CreateDateColumn() created_at: Date;
}
