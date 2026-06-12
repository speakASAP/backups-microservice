import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from "typeorm";
import { BackupTarget } from "../../targets/entities/backup-target.entity";

@Entity("backup_jobs")
export class BackupJob {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "uuid" }) target_id: string;
  @ManyToOne(() => BackupTarget) @JoinColumn({ name: "target_id" }) target: BackupTarget;
  @Column({ type: "varchar", length: 100 }) name: string;
  @Column({ type: "varchar", length: 100 }) schedule_cron: string;
  @Column({ type: "int", default: 7 }) retention_full_count: number;
  @Column({ type: "varchar", length: 255, nullable: true }) retention_approval_actor: string;
  @Column({ type: "text", nullable: true }) retention_approval_reason: string;
  @Column({ type: "timestamptz", nullable: true }) retention_approved_at: Date;
  @Column({ type: "varchar", length: 255, nullable: true }) storage_prefix: string;
  @Column({ type: "boolean", default: true }) enabled: boolean;
  @Column({ type: "timestamptz", nullable: true }) last_run_at: Date;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
