import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class CoverageModel1748563500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('backup_targets', [
      new TableColumn({ name: 'service_owner', type: 'varchar', length: '120', isNullable: true }),
      new TableColumn({ name: 'source_category', type: 'varchar', length: '40', default: "'postgres_database'" }),
      new TableColumn({ name: 'criticality', type: 'varchar', length: '20', default: "'standard'" }),
      new TableColumn({ name: 'rpo_minutes', type: 'int', isNullable: true }),
      new TableColumn({ name: 'rto_minutes', type: 'int', isNullable: true }),
      new TableColumn({ name: 'restore_class', type: 'varchar', length: '40', default: "'logical_postgres'" }),
      new TableColumn({ name: 'kubernetes_namespace', type: 'varchar', length: '80', isNullable: true }),
      new TableColumn({ name: 'coverage_notes', type: 'text', isNullable: true }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('backup_targets', 'coverage_notes');
    await queryRunner.dropColumn('backup_targets', 'kubernetes_namespace');
    await queryRunner.dropColumn('backup_targets', 'restore_class');
    await queryRunner.dropColumn('backup_targets', 'rto_minutes');
    await queryRunner.dropColumn('backup_targets', 'rpo_minutes');
    await queryRunner.dropColumn('backup_targets', 'criticality');
    await queryRunner.dropColumn('backup_targets', 'source_category');
    await queryRunner.dropColumn('backup_targets', 'service_owner');
  }
}
