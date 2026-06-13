import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';
import { getDatabaseSchema, quoteIdentifier } from '../config/database';

export class InitialSchema1748563200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const schema = getDatabaseSchema();
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema)}`);

    await queryRunner.createTable(new Table({
      name: 'backup_targets',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'name', type: 'varchar', length: '100' },
        { name: 'type', type: 'varchar', length: '20', default: "'postgres'" },
        { name: 'host', type: 'varchar', length: '255' },
        { name: 'port', type: 'int', default: '5432' },
        { name: 'database_name', type: 'varchar', length: '100' },
        { name: 'vault_secret_ref', type: 'varchar', length: '255', isNullable: true },
        { name: 'enabled', type: 'boolean', default: 'true' },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
        { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'backup_jobs',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'target_id', type: 'uuid' },
        { name: 'name', type: 'varchar', length: '100' },
        { name: 'schedule_cron', type: 'varchar', length: '100' },
        { name: 'retention_full_count', type: 'int', default: '7' },
        { name: 'storage_prefix', type: 'varchar', length: '255', isNullable: true },
        { name: 'enabled', type: 'boolean', default: 'true' },
        { name: 'last_run_at', type: 'timestamptz', isNullable: true },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
        { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);

    await queryRunner.createForeignKey('backup_jobs', new TableForeignKey({
      columnNames: ['target_id'],
      referencedTableName: 'backup_targets',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }));

    await queryRunner.createTable(new Table({
      name: 'backup_runs',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'job_id', type: 'uuid' },
        { name: 'status', type: 'varchar', length: '20', default: "'running'" },
        { name: 'started_at', type: 'timestamptz', default: 'NOW()' },
        { name: 'completed_at', type: 'timestamptz', isNullable: true },
        { name: 'size_bytes', type: 'bigint', isNullable: true },
        { name: 'storage_path', type: 'varchar', length: '500', isNullable: true },
        { name: 'walg_output', type: 'text', isNullable: true },
        { name: 'error_message', type: 'text', isNullable: true },
        { name: 'triggered_by', type: 'varchar', length: '20', default: "'scheduler'" },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);

    await queryRunner.createForeignKey('backup_runs', new TableForeignKey({
      columnNames: ['job_id'],
      referencedTableName: 'backup_jobs',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }));

    await queryRunner.createTable(new Table({
      name: 'restore_requests',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'backup_run_id', type: 'uuid' },
        { name: 'target_id', type: 'uuid' },
        { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
        { name: 'requested_by', type: 'varchar', length: '255', isNullable: true },
        { name: 'started_at', type: 'timestamptz', isNullable: true },
        { name: 'completed_at', type: 'timestamptz', isNullable: true },
        { name: 'error_message', type: 'text', isNullable: true },
        { name: 'walg_output', type: 'text', isNullable: true },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);

    await queryRunner.createForeignKey('restore_requests', new TableForeignKey({
      columnNames: ['backup_run_id'],
      referencedTableName: 'backup_runs',
      referencedColumnNames: ['id'],
      onDelete: 'CASCADE',
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('restore_requests', true);
    await queryRunner.dropTable('backup_runs', true);
    await queryRunner.dropTable('backup_jobs', true);
    await queryRunner.dropTable('backup_targets', true);
  }
}
