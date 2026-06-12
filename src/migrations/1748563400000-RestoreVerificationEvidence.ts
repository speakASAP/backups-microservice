import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RestoreVerificationEvidence1748563400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('backup_runs', [
      new TableColumn({
        name: 'verification_status',
        type: 'varchar',
        length: '20',
        default: "'unknown'",
      }),
      new TableColumn({
        name: 'verification_checked_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'verification_reason',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'verification_error',
        type: 'text',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('backup_runs', 'verification_error');
    await queryRunner.dropColumn('backup_runs', 'verification_reason');
    await queryRunner.dropColumn('backup_runs', 'verification_checked_at');
    await queryRunner.dropColumn('backup_runs', 'verification_status');
  }
}
