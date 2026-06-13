import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class SafetyAuditControls1748563600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('backup_jobs', [
      new TableColumn({ name: 'retention_approval_actor', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'retention_approval_reason', type: 'text', isNullable: true }),
      new TableColumn({ name: 'retention_approved_at', type: 'timestamptz', isNullable: true }),
    ]);

    await queryRunner.addColumns('restore_requests', [
      new TableColumn({ name: 'approval_actor', type: 'varchar', length: '255', isNullable: true }),
      new TableColumn({ name: 'approval_reason', type: 'text', isNullable: true }),
      new TableColumn({ name: 'approval_confirmed_target_id', type: 'uuid', isNullable: true }),
      new TableColumn({ name: 'approval_confirmed_backup_run_id', type: 'uuid', isNullable: true }),
      new TableColumn({ name: 'production_restore_approved', type: 'boolean', default: 'false' }),
      new TableColumn({ name: 'approved_at', type: 'timestamptz', isNullable: true }),
    ]);

    await queryRunner.createTable(new Table({
      name: 'audit_events',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'action', type: 'varchar', length: '80' },
        { name: 'actor', type: 'varchar', length: '255' },
        { name: 'target_id', type: 'uuid', isNullable: true },
        { name: 'job_id', type: 'uuid', isNullable: true },
        { name: 'backup_run_id', type: 'uuid', isNullable: true },
        { name: 'restore_request_id', type: 'uuid', isNullable: true },
        { name: 'reason', type: 'text' },
        { name: 'metadata', type: 'jsonb', isNullable: true },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_events', true);
    await queryRunner.dropColumn('restore_requests', 'approved_at');
    await queryRunner.dropColumn('restore_requests', 'production_restore_approved');
    await queryRunner.dropColumn('restore_requests', 'approval_confirmed_backup_run_id');
    await queryRunner.dropColumn('restore_requests', 'approval_confirmed_target_id');
    await queryRunner.dropColumn('restore_requests', 'approval_reason');
    await queryRunner.dropColumn('restore_requests', 'approval_actor');
    await queryRunner.dropColumn('backup_jobs', 'retention_approved_at');
    await queryRunner.dropColumn('backup_jobs', 'retention_approval_reason');
    await queryRunner.dropColumn('backup_jobs', 'retention_approval_actor');
  }
}
