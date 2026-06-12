import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class BackupDestinations1748563300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'backup_destinations',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
        { name: 'name', type: 'varchar', length: '100' },
        { name: 'type', type: 'varchar', length: '20', default: "'s3'" },
        { name: 'uri', type: 'varchar', length: '500' },
        { name: 'notes', type: 'varchar', length: '500', isNullable: true },
        { name: 'enabled', type: 'boolean', default: 'true' },
        { name: 'priority', type: 'int', default: '100' },
        { name: 'created_at', type: 'timestamptz', default: 'NOW()' },
        { name: 'updated_at', type: 'timestamptz', default: 'NOW()' },
      ],
    }), true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('backup_destinations', true);
  }
}
