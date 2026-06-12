import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TargetType { POSTGRES = 'postgres' }
export enum SourceCategory {
  POSTGRES_DATABASE = 'postgres_database',
  MINIO_BUCKET = 'minio_bucket',
  KUBERNETES_RESOURCE = 'kubernetes_resource',
  SECRET_REFERENCE = 'secret_reference',
  PVC = 'pvc',
}
export enum TargetCriticality { LOW = 'low', STANDARD = 'standard', HIGH = 'high', CRITICAL = 'critical' }
export enum RestoreClass {
  LOGICAL_POSTGRES = 'logical_postgres',
  OBJECT_RESTORE = 'object_restore',
  MANIFEST_REAPPLY = 'manifest_reapply',
  SECRET_REHYDRATION = 'secret_rehydration',
  VOLUME_RESTORE = 'volume_restore',
  MANUAL = 'manual',
}

@Entity('backup_targets')
export class BackupTarget {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'varchar', length: 20, default: 'postgres' }) type: TargetType;
  @Column({ type: 'varchar', length: 255 }) host: string;
  @Column({ type: 'int', default: 5432 }) port: number;
  @Column({ type: 'varchar', length: 100 }) database_name: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) vault_secret_ref: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) service_owner: string;
  @Column({ type: 'varchar', length: 40, default: SourceCategory.POSTGRES_DATABASE }) source_category: SourceCategory;
  @Column({ type: 'varchar', length: 20, default: TargetCriticality.STANDARD }) criticality: TargetCriticality;
  @Column({ type: 'int', nullable: true }) rpo_minutes: number;
  @Column({ type: 'int', nullable: true }) rto_minutes: number;
  @Column({ type: 'varchar', length: 40, default: RestoreClass.LOGICAL_POSTGRES }) restore_class: RestoreClass;
  @Column({ type: 'varchar', length: 80, nullable: true }) kubernetes_namespace: string;
  @Column({ type: 'text', nullable: true }) coverage_notes: string;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
