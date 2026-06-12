import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class SafetyAuditControls1748563600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('backup_jobs', [
      new TableColumn({ name: 'retention_approval_actor', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'retention_approval_reason', type: 'text', isNullable: true }),
      new TableColumn({ name: 'retention_approved_at', type: 'timestamptz', isNullable: true }),
    ]);

    await queryRunner.addColumns('restore_requests', [
      new TableColumn({ name: 'target_environment', type: 'varchar', length: '32', default: "'production'" }),
      new TableColumn({ name: 'approval_actor', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'approval_reason', type: 'text', isNullable: true }),
      new TableColumn({ name: 'approval_confirmed', type: 'boolean', default: 'false' }),
      new TableColumn({ name: 'approval_recorded_at', type: 'timestamptz', isNullable: true }),
    ]);

    await queryRunner.createTable(new Table({
      name: 'backup_audit_logs',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'action', type: 'varchar', length: '80' },
        { name: 'actor', type: 'varchar', length: '255', isNullable: true },
        { name: 'target_id', type: 'uuid', isNullable: true },
        { name: 'job_id', type: 'uuid', isNullable: true },
        { name: 'backup_run_id', type: 'uuid', isNullable: true },
        { name: 'restore_request_id', type: 'uuid', isNullable: true },
        { name: 'reason', type: 'text', isNullable: true },
        { name: 'metadata', type: 'jsonb', isNullable: true },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('backup_audit_logs', true);
    await queryRunner.dropColumn('restore_requests', 'approval_recorded_at');
    await queryRunner.dropColumn('restore_requests', 'approval_confirmed');
    await queryRunner.dropColumn('restore_requests', 'approval_reason');
    await queryRunner.dropColumn('restore_requests', 'approval_actor');
    await queryRunner.dropColumn('restore_requests', 'target_environment');
    await queryRunner.dropColumn('backup_jobs', 'retention_approved_at');
    await queryRunner.dropColumn('backup_jobs', 'retention_approval_reason');
    await queryRunner.dropColumn('backup_jobs', 'retention_approval_actor');
  }
}
