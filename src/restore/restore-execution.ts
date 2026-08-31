import { BadRequestException } from '@nestjs/common';
import { logicalBackupObjectName } from '../backup/walg-wrapper.service';
import { assertSafeDatabaseName } from '../common/database-name';
import { BackupRun, BackupRunStatus } from '../backup/entities/backup-run.entity';
import { BackupTarget, SourceCategory } from '../targets/entities/backup-target.entity';

export interface LogicalRestoreLocation {
  storagePrefix: string;
  objectName: string;
}

export function logicalRestoreLocation(run: BackupRun): LogicalRestoreLocation {
  if (!run.storage_path) {
    throw new BadRequestException('Backup run has no logical backup object path.');
  }

  let objectName: string;
  try {
    objectName = logicalBackupObjectName(run.id);
  } catch {
    throw new BadRequestException('Backup run ID is invalid for logical restore.');
  }

  const suffix = `/${objectName}`;
  if (!run.storage_path.startsWith('s3://') || !run.storage_path.endsWith(suffix)) {
    throw new BadRequestException('Backup run storage path does not match its deterministic logical object.');
  }

  const storagePrefix = run.storage_path.slice(0, -suffix.length);
  if (!storagePrefix) {
    throw new BadRequestException('Backup run storage prefix is invalid.');
  }

  return { storagePrefix, objectName };
}

export function assertPostgresRestoreTarget(target: BackupTarget): void {
  if ((target.source_category || SourceCategory.POSTGRES_DATABASE) !== SourceCategory.POSTGRES_DATABASE) {
    throw new BadRequestException('Restore execution is only implemented for postgres_database targets.');
  }
  if (!target.database_name) {
    throw new BadRequestException('PostgreSQL restore target database is required.');
  }
  assertSafeDatabaseName(target.database_name, 'Restore target');
}

export function assertRestorableRun(run: BackupRun): void {
  if (run.status !== BackupRunStatus.SUCCESS) {
    throw new BadRequestException('Only successful backup runs can be restored.');
  }
}
