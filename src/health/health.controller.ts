import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { Public } from '../auth/roles.decorator';
import { SchemaReadinessService } from '../schema/schema-readiness.service';

type ReadinessCheck = {
  status: 'ready' | 'degraded' | 'not_ready';
  message: string;
  details?: Record<string, unknown>;
};

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly schemaReadiness: SchemaReadinessService,
  ) {}

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
    const restoreSerialization = this.checkRestoreSerialization();
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
        restore_serialization: restoreSerialization,
      },
    };
  }

  /**
   * Restore serialization is reported on its own endpoint rather than through the
   * pod readiness gate. Losing the per-target unique index must stop destructive
   * restores - which it does, with a 503 from this endpoint and from the restore
   * API - but it must not remove the service from its Service endpoints, because
   * that would also stop the scheduled backups that protect the same data.
   */
  @Public()
  @Get('restore-readiness')
  restoreReadiness(@Res({ passthrough: true }) response: Response) {
    const restoreSerialization = this.checkRestoreSerialization();
    const ready = restoreSerialization.status === 'ready';

    if (!ready) response.status(HttpStatus.SERVICE_UNAVAILABLE);

    return {
      success: ready,
      status: ready ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'backups-microservice',
      checks: {
        restore_serialization: restoreSerialization,
      },
    };
  }

  private checkRestoreSerialization(): ReadinessCheck {
    const state = this.schemaReadiness.getRestoreSerializationState();
    return {
      status: state.ready ? 'ready' : 'degraded',
      message: state.reason,
      details: {
        index_installed: state.ready,
        duplicate_active_targets: state.duplicate_targets,
        checked_at: state.checked_at,
        restores_accepted: state.ready,
        blocks_pod_readiness: false,
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
