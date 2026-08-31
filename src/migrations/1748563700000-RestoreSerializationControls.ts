import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { getDatabaseSchema, qualifyTable, quoteIdentifier } from '../config/database';
import {
  RESTORE_ACTIVE_TARGET_INDEX,
  RESTORE_IDEMPOTENCY_INDEX,
} from '../restore/restore-constraints';

export class RestoreSerializationControls1748563700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = qualifyTable(getDatabaseSchema(), 'restore_requests');

    await queryRunner.addColumns('restore_requests', [
      new TableColumn({ name: 'idempotency_key', type: 'varchar', length: '200', isNullable: true }),
    ]);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "${RESTORE_IDEMPOTENCY_INDEX}" ON ${table} (idempotency_key) WHERE idempotency_key IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "${RESTORE_ACTIVE_TARGET_INDEX}" ON ${table} (target_id) WHERE status IN ('pending', 'running')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const schema = quoteIdentifier(getDatabaseSchema());
    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."${RESTORE_ACTIVE_TARGET_INDEX}"`);
    await queryRunner.query(`DROP INDEX IF EXISTS ${schema}."${RESTORE_IDEMPOTENCY_INDEX}"`);
    await queryRunner.dropColumn('restore_requests', 'idempotency_key');
  }
}
