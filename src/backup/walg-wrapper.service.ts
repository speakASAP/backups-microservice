import { Injectable } from '@nestjs/common';
import { ChildProcess, spawn } from 'child_process';
import { pipeline } from 'stream';
import { assertSafeDatabaseName } from '../common/database-name';
import { LoggerService } from '../../shared/logger/logger.service';

export interface WalgEnv {
  WALG_S3_PREFIX: string;
  WALG_S3_ENDPOINT_SUFFIX: string;
  WALG_COMPRESSION_METHOD: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_ENDPOINT: string;
  PGHOST: string;
  PGPORT: string;
  PGDATABASE: string;
  PGPASSWORD: string;
  PGUSER: string;
  AWS_S3_FORCE_PATH_STYLE: string;
}

export interface WalgResult {
  exitCode: number;
  output: string;
}

/**
 * Outcome of an exact-object storage probe.
 *
 * `unknown` is deliberately distinct from `absent`: a listing that failed, was
 * ambiguous, or reported an unusable size proves nothing, and every caller must
 * treat it as "do not delete" rather than "object is gone".
 */
export type LogicalObjectProbeStatus = 'present' | 'absent' | 'unknown';

export interface LogicalObjectProbe {
  status: LogicalObjectProbeStatus;
  size: number | null;
  output: string;
}

interface PipedCommand {
  name: string;
  command: string;
  args: string[];
}

const BACKUP_OBJECT_ROOT = 'logical';
const BACKUP_OBJECT_SUFFIX = '.dump';
const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const UUID_PATTERN = new RegExp(`^${UUID_SOURCE}$`, 'i');
const LOGICAL_OBJECT_PATTERN = new RegExp(
  `^${BACKUP_OBJECT_ROOT}/${UUID_SOURCE}\\${BACKUP_OBJECT_SUFFIX}$`,
  'i',
);
const KILL_ESCALATION_MS = 10_000;

export function logicalBackupObjectName(runId: string): string {
  if (!UUID_PATTERN.test(runId)) {
    throw new Error('Invalid backup run ID for logical backup object.');
  }
  return `${BACKUP_OBJECT_ROOT}/${runId}${BACKUP_OBJECT_SUFFIX}`;
}

export function isLogicalBackupObjectName(objectName: unknown): boolean {
  return typeof objectName === 'string' && LOGICAL_OBJECT_PATTERN.test(objectName);
}

export function assertLogicalBackupObjectName(objectName: unknown): string {
  if (!isLogicalBackupObjectName(objectName)) {
    throw new Error('Refusing to address a non-deterministic logical backup object.');
  }
  return objectName as string;
}

export function logicalBackupStoragePath(prefix: string, objectName: string): string {
  return `${prefix.replace(/\/+$/, '')}/${objectName.replace(/^\/+/, '')}`;
}

export function relativeStorageObject(prefix: string, storagePath: string): string {
  const normalizedPrefix = prefix.replace(/\/+$/, '');
  const expectedStart = `${normalizedPrefix}/`;
  if (!storagePath.startsWith(expectedStart)) {
    throw new Error('Backup storage path is outside the configured job prefix.');
  }
  const objectName = storagePath.slice(expectedStart.length);
  if (!objectName || objectName.includes('..')) {
    throw new Error('Backup storage object path is invalid.');
  }
  return objectName;
}

@Injectable()
export class WalgWrapperService {
  constructor(private logger: LoggerService) {}

  buildEnv(job: { storage_prefix?: string }, target: { host: string; port: number; database_name: string }, dbPassword: string): WalgEnv {
    const databaseName = assertSafeDatabaseName(target.database_name);
    const s3Prefix = job.storage_prefix || `${process.env.WALG_S3_PREFIX || 's3://backups'}/${databaseName}`;
    const endpoint = process.env.WALG_S3_ENDPOINT || process.env.MINIO_ENDPOINT || process.env.MINIO_SERVICE_URL || '';
    const endpointSuffix = endpoint.replace(/^https?:\/\//, '');

    return {
      WALG_S3_PREFIX: s3Prefix,
      WALG_S3_ENDPOINT_SUFFIX: endpointSuffix,
      WALG_COMPRESSION_METHOD: process.env.WALG_COMPRESSION_METHOD || 'lz4',
      AWS_ACCESS_KEY_ID: process.env.MINIO_ACCESS_KEY || '',
      AWS_SECRET_ACCESS_KEY: process.env.MINIO_SECRET_KEY || '',
      AWS_ENDPOINT: endpoint,
      AWS_S3_FORCE_PATH_STYLE: 'true',
      PGHOST: target.host,
      PGPORT: String(target.port),
      PGDATABASE: databaseName,
      PGPASSWORD: dbPassword,
      PGUSER: process.env.DB_USER || 'dbadmin',
    };
  }

  run(args: string[], env: WalgEnv, onData?: (chunk: string) => void): Promise<WalgResult> {
    return new Promise((resolve) => {
      const proc = spawn('wal-g', args, {
        env: { ...process.env, ...env },
      });

      let output = '';

      const handle = (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
        if (onData) onData(chunk);
      };

      proc.stdout.on('data', handle);
      proc.stderr.on('data', handle);

      proc.on('close', (code) => {
        resolve({ exitCode: code ?? 1, output });
      });

      proc.on('error', (err) => {
        const msg = `Failed to spawn wal-g: ${err.message}`;
        output += msg;
        if (onData) onData(msg);
        this.logger.error(msg, err.stack, 'WalgWrapperService');
        resolve({ exitCode: 1, output });
      });
    });
  }

  async backupPush(env: WalgEnv, objectName: string, onData?: (chunk: string) => void): Promise<WalgResult> {
    const rejection = this.rejectUnsafeObject(objectName, onData);
    if (rejection) return rejection;
    const result = await this.runPipedPair(
      {
        name: 'pg_dump',
        command: 'pg_dump',
        args: ['--format=custom', '--no-owner', '--no-privileges', '--no-password'],
      },
      {
        name: 'wal-g',
        command: 'wal-g',
        args: ['st', 'put', '--read-stdin', '--no-compress', objectName],
      },
      env,
      `logical_backup_object: ${objectName}\n`,
      onData,
    );
    if (result.exitCode === 0) return result;
    return this.discardPartialObject(env, objectName, result, onData);
  }

  /**
   * A failed or terminated upload can still have created a truncated object at the
   * run's deterministic key. That key belongs to this failed run alone and is never
   * recorded as a storage path, so removing it can never touch a retained backup.
   */
  private async discardPartialObject(
    env: WalgEnv,
    objectName: string,
    result: WalgResult,
    onData?: (chunk: string) => void,
  ): Promise<WalgResult> {
    const cleanup = await this.deleteLogicalObject(env, objectName);
    const message = `partial_object_cleanup: ${cleanup.exitCode === 0 ? 'removed' : 'unconfirmed'} ${objectName}\n`;
    if (onData) onData(message);
    return { exitCode: result.exitCode, output: `${result.output}${message}` };
  }

  async restoreFromObject(
    env: WalgEnv,
    objectName: string,
    targetDatabase: string,
    onData?: (chunk: string) => void,
  ): Promise<WalgResult> {
    const rejection = this.rejectUnsafeObject(objectName, onData);
    if (rejection) return rejection;
    let databaseName: string;
    try {
      databaseName = assertSafeDatabaseName(targetDatabase, 'Restore target');
    } catch (error) {
      return this.rejected(error instanceof Error ? error.message : 'Restore target database name rejected.', onData);
    }
    return this.runPipedPair(
      {
        name: 'wal-g',
        command: 'wal-g',
        args: ['st', 'cat', objectName],
      },
      {
        name: 'pg_restore',
        command: 'pg_restore',
        args: [
          `--dbname=${databaseName}`,
          '--clean',
          '--if-exists',
          '--no-owner',
          '--no-privileges',
          '--exit-on-error',
          '--single-transaction',
        ],
      },
      env,
      `logical_restore_object: ${objectName}\n`,
      onData,
    );
  }

  async backupList(env: WalgEnv): Promise<WalgResult> {
    return this.run(['st', 'ls', '--recursive'], env);
  }

  /**
   * Proves whether exactly one deterministic `logical/<run-id>.dump` object is
   * present and readable, without transferring the dump.
   *
   * WAL-G 3.x exposes `st ls [relative folder path]`, which reports one row per
   * entry as `type size last-modified name`. The probe lists only the object's
   * own folder, never recursively and never with a glob, and accepts a row only
   * when its type is `obj`, its name is byte-identical to the object's leaf, and
   * its size is a positive number. Anything else - a failed listing, no match, a
   * duplicate match, a folder entry, or an unparseable or zero size - resolves to
   * `absent` or `unknown` so the caller defers instead of deleting.
   */
  async probeLogicalObject(env: WalgEnv, objectName: string): Promise<LogicalObjectProbe> {
    if (!isLogicalBackupObjectName(objectName)) {
      const message = 'Refusing to probe a non-deterministic logical backup object.';
      this.logger.error(message, undefined, 'WalgWrapperService');
      return { status: 'unknown', size: null, output: message };
    }

    const separator = objectName.lastIndexOf('/');
    const folder = objectName.slice(0, separator);
    const leaf = objectName.slice(separator + 1);

    const result = await this.run(['st', 'ls', folder], env);
    if (result.exitCode !== 0) {
      return { status: 'unknown', size: null, output: result.output };
    }

    const rows = result.output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split(/\s+/))
      .filter((columns) => columns.length >= 3 && columns[0] === 'obj' && columns[columns.length - 1] === leaf);

    if (rows.length === 0) return { status: 'absent', size: null, output: result.output };
    if (rows.length > 1) return { status: 'unknown', size: null, output: result.output };

    const size = Number(rows[0][1]);
    if (!Number.isFinite(size) || size <= 0) {
      return { status: 'unknown', size: null, output: result.output };
    }
    return { status: 'present', size, output: result.output };
  }

  /**
   * Removes exactly one deterministic `logical/<run-id>.dump` object. The name is
   * pattern-checked first, so a prefix, folder, or partially formed key can never
   * be handed to `wal-g st rm`.
   */
  async deleteLogicalObject(env: WalgEnv, objectName: string): Promise<WalgResult> {
    const rejection = this.rejectUnsafeObject(objectName);
    if (rejection) return rejection;
    return this.run(['st', 'rm', objectName], env);
  }

  private rejectUnsafeObject(objectName: string, onData?: (chunk: string) => void): WalgResult | null {
    if (isLogicalBackupObjectName(objectName)) return null;
    return this.rejected('Refusing to address a non-deterministic logical backup object.', onData);
  }

  private rejected(message: string, onData?: (chunk: string) => void): WalgResult {
    if (onData) onData(message);
    this.logger.error(message, undefined, 'WalgWrapperService');
    return { exitCode: 1, output: message };
  }

  /**
   * Streams a producer's stdout straight into a consumer's stdin without buffering
   * archive bytes. Any stream error or premature close fails the pipeline and both
   * children are terminated, so a truncated transfer can never report success.
   */
  private runPipedPair(
    producer: PipedCommand,
    consumer: PipedCommand,
    env: WalgEnv,
    successMessage: string,
    onData?: (chunk: string) => void,
  ): Promise<WalgResult> {
    return new Promise((resolve) => {
      const childEnv = { ...process.env, ...env };
      let output = '';
      const append = (chunk: string) => {
        output += chunk;
        if (onData) onData(chunk);
      };

      const producerProc = spawn(producer.command, producer.args, { env: childEnv });
      const consumerProc = spawn(consumer.command, consumer.args, { env: childEnv });

      let producerDone = false;
      let consumerDone = false;
      let producerExitCode = 1;
      let consumerExitCode = 1;
      let streamFailure = false;
      let resolved = false;
      const escalations: NodeJS.Timeout[] = [];

      const terminate = (proc: ChildProcess) => {
        try {
          proc.kill('SIGTERM');
        } catch {
          /* the child already exited */
        }
        const escalation = setTimeout(() => {
          try {
            proc.kill('SIGKILL');
          } catch {
            /* the child already exited */
          }
        }, KILL_ESCALATION_MS);
        if (typeof escalation.unref === 'function') escalation.unref();
        escalations.push(escalation);
      };

      const terminateBoth = () => {
        if (!producerDone) terminate(producerProc);
        if (!consumerDone) terminate(consumerProc);
      };

      const handle = (source: string) => (data: Buffer) => {
        append(`${source}: ${data.toString()}`);
      };

      const failSpawn = (command: string, err: Error) => {
        const message = `Failed to spawn ${command}: ${err.message}`;
        append(message);
        this.logger.error(message, err.stack, 'WalgWrapperService');
      };

      const failStream = (err: Error) => {
        if (streamFailure) return;
        streamFailure = true;
        const message = `${producer.name} -> ${consumer.name} stream failed: ${err.message}\n`;
        append(message);
        this.logger.error(message, err.stack, 'WalgWrapperService');
        terminateBoth();
      };

      const finish = () => {
        if (resolved || !producerDone || !consumerDone) return;
        resolved = true;
        escalations.forEach((escalation) => clearTimeout(escalation));
        const exitCode = !streamFailure && producerExitCode === 0 && consumerExitCode === 0 ? 0 : 1;
        if (exitCode === 0) {
          append(successMessage);
        }
        resolve({ exitCode, output });
      };

      producerProc.stderr.on('data', handle(producer.name));
      consumerProc.stdout.on('data', handle(consumer.name));
      consumerProc.stderr.on('data', handle(consumer.name));

      pipeline(producerProc.stdout, consumerProc.stdin, (err) => {
        if (!err) return;
        failStream(err);
        finish();
      });

      producerProc.on('error', (err) => {
        failSpawn(producer.name, err);
        producerDone = true;
        producerExitCode = 1;
        if (!consumerDone) terminate(consumerProc);
        finish();
      });
      consumerProc.on('error', (err) => {
        failSpawn(consumer.name, err);
        consumerDone = true;
        consumerExitCode = 1;
        if (!producerDone) terminate(producerProc);
        finish();
      });
      producerProc.on('close', (code) => {
        producerDone = true;
        producerExitCode = code ?? 1;
        if (producerExitCode !== 0 && !consumerDone) terminate(consumerProc);
        finish();
      });
      consumerProc.on('close', (code) => {
        consumerDone = true;
        consumerExitCode = code ?? 1;
        if (consumerExitCode !== 0 && !producerDone) terminate(producerProc);
        finish();
      });
    });
  }
}
