import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
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

@Injectable()
export class WalgWrapperService {
  constructor(private logger: LoggerService) {}

  buildEnv(job: { storage_prefix?: string }, target: { host: string; port: number; database_name: string }, dbPassword: string): WalgEnv {
    const s3Prefix = job.storage_prefix || `${process.env.WALG_S3_PREFIX || 's3://backups'}/${target.database_name}`;
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
      PGDATABASE: target.database_name,
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
        this.logger.error(msg, err.stack, 'WalgWrapperService');
        resolve({ exitCode: 1, output });
      });
    });
  }

  async backupPush(env: WalgEnv, onData?: (chunk: string) => void): Promise<WalgResult> {
    return this.run(['pgbackup', '--full-backup'], env, onData);
  }

  async backupList(env: WalgEnv): Promise<WalgResult> {
    return this.run(['pgbackup-list', '--pretty', '--detail'], env);
  }

  async deleteRetain(env: WalgEnv, retainCount: number): Promise<WalgResult> {
    return this.run(['delete', 'retain', 'FULL', String(retainCount), '--confirm'], env);
  }
}
