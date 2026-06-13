import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from '../auth/roles.decorator';

type ReadinessCheck = {
  status: 'ready' | 'degraded' | 'not_ready';
  message: string;
  details?: Record<string, unknown>;
};

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  health() {
    return {
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'backups-microservice',
    };
  }

  @Public()
  @Get('readiness')
  async readiness(@Res({ passthrough: true }) response: Response) {
    const [database, storage] = await Promise.all([
      this.checkDatabase(),
      this.checkStorage(),
    ]);
    const ready = database.status === 'ready' && storage.status === 'ready';

    if (!ready) response.status(HttpStatus.SERVICE_UNAVAILABLE);

    return {
      success: ready,
      status: ready ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'backups-microservice',
      checks: {
        database,
        storage,
      },
    };
  }

  private async checkDatabase(): Promise<ReadinessCheck> {
    if (!this.dataSource.isInitialized) {
      return {
        status: 'not_ready',
        message: 'Database connection is not initialized',
      };
    }

    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'ready',
        message: 'Database connection is ready',
      };
    } catch (error) {
      return {
        status: 'not_ready',
        message: 'Database connection is not ready',
        details: {
          error: this.sanitizeError(error),
        },
      };
    }
  }

  private async checkStorage(): Promise<ReadinessCheck> {
    const bucket = process.env.MINIO_BUCKET || process.env.MINIO_BACKUP_BUCKET || '';
    const prefix = process.env.WALG_S3_PREFIX || '';
    const endpointConfigured = Boolean(
      process.env.WALG_S3_ENDPOINT
      || process.env.MINIO_ENDPOINT
      || process.env.MINIO_SERVICE_URL,
    );
    const prefixConfigured = Boolean(prefix);
    const bucketConfigured = Boolean(bucket);

    if (!endpointConfigured || (!prefixConfigured && !bucketConfigured)) {
      return {
        status: 'not_ready',
        message: 'Storage configuration is incomplete',
        details: {
          endpoint_configured: endpointConfigured,
          prefix_configured: prefixConfigured,
          bucket_configured: bucketConfigured,
        },
      };
    }

    return {
      status: 'ready',
      message: 'Storage configuration is present',
      details: {
        endpoint_configured: true,
        prefix_configured: prefixConfigured,
        bucket_configured: bucketConfigured,
      },
    };
  }

  private sanitizeError(error: unknown): string {
    if (!(error instanceof Error)) return 'unknown error';
    return error.message.replace(/(password|token|secret|key)=([^\s]+)/gi, '$1=[redacted]');
  }
}
