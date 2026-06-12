import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum DestinationType {
  S3 = 's3',
  LOCAL = 'local',
  FILESYSTEM = 'filesystem',
}

@Entity('backup_destinations')
export class BackupDestination {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20, default: DestinationType.S3 })
  type: DestinationType;

  @Column({ type: 'varchar', length: 500 })
  uri: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'int', default: 100 })
  priority: number;

  @CreateDateColumn() created_at: Date;

  @UpdateDateColumn() updated_at: Date;
}
