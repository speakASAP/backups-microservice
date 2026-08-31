import { BadRequestException } from '@nestjs/common';
import { BackupRun, BackupRunStatus } from '../src/backup/entities/backup-run.entity';
import { SourceCategory } from '../src/targets/entities/backup-target.entity';
import {
  assertPostgresRestoreTarget,
  assertRestorableRun,
  logicalRestoreLocation,
} from '../src/restore/restore-execution';

describe('restore execution helpers', () => {
  const runId = '00000000-0000-4000-8000-000000000001';

  it('derives the exact deterministic WAL-G object and storage prefix', () => {
    expect(logicalRestoreLocation({
      id: runId,
      storage_path: `s3://backups/mydb/logical/${runId}.dump`,
    } as BackupRun)).toEqual({
      storagePrefix: 's3://backups/mydb',
      objectName: `logical/${runId}.dump`,
    });
  });

  it('rejects missing, foreign, or non-deterministic storage paths', () => {
    expect(() => logicalRestoreLocation({ id: runId, storage_path: null } as BackupRun)).toThrow(BadRequestException);
    expect(() => logicalRestoreLocation({ id: runId, storage_path: `file:///logical/${runId}.dump` } as BackupRun)).toThrow(BadRequestException);
    expect(() => logicalRestoreLocation({
      id: runId,
      storage_path: 's3://backups/mydb/logical/00000000-0000-4000-8000-000000000002.dump',
    } as BackupRun)).toThrow(BadRequestException);
  });

  it('allows only successful backup runs to restore', () => {
    expect(() => assertRestorableRun({ status: BackupRunStatus.SUCCESS } as BackupRun)).not.toThrow();
    expect(() => assertRestorableRun({ status: BackupRunStatus.FAILED } as BackupRun)).toThrow(BadRequestException);
  });

  it('allows only PostgreSQL targets with an explicit database name', () => {
    expect(() => assertPostgresRestoreTarget({
      source_category: SourceCategory.POSTGRES_DATABASE,
      database_name: 'restored',
    } as any)).not.toThrow();
    expect(() => assertPostgresRestoreTarget({
      source_category: SourceCategory.MINIO_BUCKET,
      database_name: 'bucket',
    } as any)).toThrow(BadRequestException);
    expect(() => assertPostgresRestoreTarget({
      source_category: SourceCategory.POSTGRES_DATABASE,
      database_name: '',
    } as any)).toThrow(BadRequestException);
  });

  it('rejects URI, key=value, option-like and whitespace database names', () => {
    for (const databaseName of [
      'postgres://user:pass@host:5432/db',
      'dbname=evil',
      '--dbname=evil',
      '-h',
      'restored db',
      'restored\tdb',
      'restored\u0000db',
      'a'.repeat(64),
    ]) {
      expect(() => assertPostgresRestoreTarget({
        source_category: SourceCategory.POSTGRES_DATABASE,
        database_name: databaseName,
      } as any)).toThrow(BadRequestException);
    }
  });
});
