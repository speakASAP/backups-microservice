import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupJob } from '../jobs/entities/backup-job.entity';
import {
  BackupTarget,
  RestoreClass,
  SourceCategory,
  TargetCriticality,
  TargetType,
} from '../targets/entities/backup-target.entity';

const DEFAULT_SCHEDULE = '0 2 * * *';
const DEFAULT_RETENTION_FULL_COUNT = 7;

function envString(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value || fallback;
}

function envInt(key: string, fallback: number): number {
  const value = Number.parseInt(process.env[key] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function defaultNightlyConfig() {
  const databaseName = envString('BACKUP_TARGET_DATABASE', envString('DB_NAME', 'backups'));
  const host = envString('BACKUP_TARGET_HOST', envString('DB_HOST', 'db-server-postgres'));
  const port = envInt('BACKUP_TARGET_PORT', envInt('DB_PORT', 5432));
  const name = envString('BACKUP_DEFAULT_JOB_NAME', `Nightly PostgreSQL backup: ${databaseName}`);
  const storagePrefix = process.env.BACKUP_STORAGE_PREFIX?.trim()
    || `${envString('WALG_S3_PREFIX', 's3://backups')}/${databaseName}`;

  return {
    enabled: envBool('BACKUPS_DEFAULT_NIGHTLY_ENABLED', true),
    targetName: envString('BACKUP_TARGET_NAME', databaseName),
    host,
    port,
    databaseName,
    vaultSecretRef: process.env.BACKUP_TARGET_VAULT_SECRET_REF?.trim() || null,
    serviceOwner: process.env.BACKUP_TARGET_SERVICE_OWNER?.trim() || 'platform',
    scheduleCron: envString('BACKUP_SCHEDULE_DB', DEFAULT_SCHEDULE),
    retentionFullCount: envInt('BACKUP_RETENTION_FULL_COUNT', DEFAULT_RETENTION_FULL_COUNT),
    jobName: name,
    storagePrefix,
  };
}

@Injectable()
export class NightlyBackupBootstrapService {
  private readonly logger = new Logger(NightlyBackupBootstrapService.name);

  constructor(
    @InjectRepository(BackupTarget) private readonly targetRepo: Repository<BackupTarget>,
    @InjectRepository(BackupJob) private readonly jobRepo: Repository<BackupJob>,
  ) {}

  async ensureDefaultNightlyJob(): Promise<BackupJob | null> {
    const config = defaultNightlyConfig();
    if (!config.enabled) {
      this.logger.warn('Default nightly PostgreSQL backup bootstrap disabled by BACKUPS_DEFAULT_NIGHTLY_ENABLED=false');
      return null;
    }

    const target = await this.ensureTarget(config);
    const job = await this.ensureJob(target, config);
    this.logger.log(`Default nightly PostgreSQL backup job ready: ${job.name}`);
    return job;
  }

  private async ensureTarget(config: ReturnType<typeof defaultNightlyConfig>): Promise<BackupTarget> {
    const existing = await this.targetRepo.findOne({
      where: {
        host: config.host,
        port: config.port,
        database_name: config.databaseName,
      },
    });

    const target = existing || this.targetRepo.create();
    target.name = existing?.name || config.targetName;
    target.type = TargetType.POSTGRES;
    target.host = config.host;
    target.port = config.port;
    target.database_name = config.databaseName;
    target.vault_secret_ref = config.vaultSecretRef;
    target.service_owner = target.service_owner || config.serviceOwner;
    target.source_category = SourceCategory.POSTGRES_DATABASE;
    target.criticality = target.criticality || TargetCriticality.CRITICAL;
    target.restore_class = RestoreClass.LOGICAL_POSTGRES;
    target.coverage_notes = target.coverage_notes || 'Default nightly PostgreSQL backup target managed by Backups startup bootstrap.';
    target.enabled = true;

    return this.targetRepo.save(target);
  }

  private async ensureJob(target: BackupTarget, config: ReturnType<typeof defaultNightlyConfig>): Promise<BackupJob> {
    const existing = await this.jobRepo.findOne({
      where: {
        target_id: target.id,
        name: config.jobName,
      },
    });

    const job = existing || this.jobRepo.create({ target_id: target.id, name: config.jobName });
    job.target_id = target.id;
    job.name = config.jobName;
    job.schedule_cron = config.scheduleCron;
    job.retention_full_count = Math.max(config.retentionFullCount, DEFAULT_RETENTION_FULL_COUNT);
    job.storage_prefix = config.storagePrefix;
    job.enabled = true;

    return this.jobRepo.save(job);
  }
}
