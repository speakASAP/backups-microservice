import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Response } from 'express';
import { Public } from '../auth/roles.decorator';

type ReadinessCheck = {
  status: 'ready' | 'not_ready';
  checked_at: string;
  details?: Record<string, boolean | string>;
};

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async health() {
    const checks = await this.checks();
    return {
      success: true,
      status: this.overallStatus(checks),
      timestamp: new Date().toISOString(),
      service: 'backups-microservice',
      checks,
    };
  }

  @Public()
  @Get('readiness')
  async readiness(@Res({ passthrough: true }) response: Response) {
    const checks = await this.checks();
    const status = this.overallStatus(checks);
    if (status !== 'ready') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      success: status === 'ready',
      status,
      timestamp: new Date().toISOString(),
      service: 'backups-microservice',
      checks,
    };
  }

  private async checks(): Promise<{ database: ReadinessCheck; storage: ReadinessCheck }> {
    const [database, storage] = await Promise.all([this.databaseCheck(), this.storageCheck()]);
    return { database, storage };
  }

  private async databaseCheck(): Promise<ReadinessCheck> {
    const checked_at = new Date().toISOString();
    try {
      if (!this.dataSource.isInitialized) {
        return { status: 'not_ready', checked_at, details: { initialized: false } };
      }
      await this.dataSource.query('SELECT 1');
      return { status: 'ready', checked_at, details: { initialized: true } };
    } catch {
      return { status: 'not_ready', checked_at, details: { initialized: this.dataSource.isInitialized } };
    }
  }

  private async storageCheck(): Promise<ReadinessCheck> {
    const checked_at = new Date().toISOString();
    const prefix = process.env.WALG_S3_PREFIX || '';
    const endpoint = process.env.WALG_S3_ENDPOINT || process.env.MINIO_ENDPOINT || process.env.MINIO_SERVICE_URL || '';
    const bucket = process.env.MINIO_BUCKET || process.env.MINIO_BACKUP_BUCKET || '';
    const details = {
      prefix_configured: prefix.startsWith('s3://'),
      endpoint_configured: Boolean(endpoint),
      bucket_configured: Boolean(bucket),
      credentials_referenced: Boolean(process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID)
        && Boolean(process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY),
    };
    const ready = details.prefix_configured && details.endpoint_configured && details.bucket_configured;
    return { status: ready ? 'ready' : 'not_ready', checked_at, details };
  }

  private overallStatus(checks: { database: ReadinessCheck; storage: ReadinessCheck }) {
    return Object.values(checks).every((check) => check.status === 'ready') ? 'ready' : 'degraded';
  }
}
