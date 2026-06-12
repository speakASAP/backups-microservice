import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TargetType { POSTGRES = 'postgres' }

@Entity('backup_targets')
export class BackupTarget {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ type: 'varchar', length: 20, default: 'postgres' }) type: TargetType;
  @Column({ type: 'varchar', length: 255 }) host: string;
  @Column({ type: 'int', default: 5432 }) port: number;
  @Column({ type: 'varchar', length: 100 }) database_name: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) vault_secret_ref: string;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}
