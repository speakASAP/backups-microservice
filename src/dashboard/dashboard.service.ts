import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupRun, BackupRunStatus, VerificationStatus } from '../backup/entities/backup-run.entity';
import { BackupJob } from '../jobs/entities/backup-job.entity';
import { RestoreRequest } from '../restore/entities/restore-request.entity';
import { BackupTarget } from '../targets/entities/backup-target.entity';
import { BackupDestination } from '../destinations/entities/backup-destination.entity';
import { DiscoveryService } from '../discovery/discovery.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(BackupTarget) private readonly targetRepo: Repository<BackupTarget>,
    @InjectRepository(BackupJob) private readonly jobRepo: Repository<BackupJob>,
    @InjectRepository(BackupRun) private readonly runRepo: Repository<BackupRun>,
    @InjectRepository(RestoreRequest) private readonly restoreRepo: Repository<RestoreRequest>,
    @InjectRepository(BackupDestination) private readonly destinationRepo: Repository<BackupDestination>,
    private readonly discoveryService: DiscoveryService,
  ) {}

  async summary() {
    const [targets, jobs, recentRuns, restores, destinations, discovery] = await Promise.all([
      this.targetRepo.find({ order: { created_at: 'DESC' } }),
      this.jobRepo.find({ relations: ['target'], order: { created_at: 'DESC' } }),
      this.runRepo.find({ relations: ['job'], order: { started_at: 'DESC' }, take: 80 }),
      this.restoreRepo.find({ relations: ['backup_run', 'target'], order: { created_at: 'DESC' }, take: 40 }),
      this.destinationRepo.find({ order: { enabled: 'DESC', priority: 'ASC', created_at: 'DESC' } }),
      this.discoveryService.kubernetes().catch((error) => ({
        available: false,
        generated_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unable to inspect Kubernetes services',
        databases: [],
        services: [],
        workloads: [],
      })),
    ]);

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const recent24h = recentRuns.filter((run) => run.started_at && now - new Date(run.started_at).getTime() <= dayMs);
    const successfulRuns = recentRuns.filter((run) => run.status === BackupRunStatus.SUCCESS);
    const failed24h = recent24h.filter((run) => run.status === BackupRunStatus.FAILED);
    const verificationPending = recentRuns.filter((run) => {
      return run.verification_status === VerificationStatus.PENDING
        || run.verification_status === VerificationStatus.VERIFYING
        || run.verification_status === VerificationStatus.UNKNOWN;
    });
    const verificationFailed = recentRuns.filter((run) => run.verification_status === VerificationStatus.FAILED);
    const latestRun = recentRuns[0];
    const latestSuccess = successfulRuns[0];

    const jobsByTarget = new Map<string, BackupJob[]>();
    for (const job of jobs) {
      const list = jobsByTarget.get(job.target_id) || [];
      list.push(job);
      jobsByTarget.set(job.target_id, list);
    }

    const unprotectedDiscoveredSources = this.unprotectedDiscoveredSources(discovery, targets);
    const protectedTargets = targets.filter((target) => {
      const targetJobs = jobsByTarget.get(target.id) || [];
      return target.enabled && targetJobs.some((job) => job.enabled);
    });

    return {
      generated_at: new Date().toISOString(),
      storage: this.storageSettings(),
      guardrails: {
        retention_min_full_backups: 3,
        restore_requires_human_approval: true,
        delete_backup_runs_allowed_for_agents: false,
        secrets_source: 'Vault / External Secrets Operator',
      },
      stats: {
        targets_total: targets.length,
        targets_enabled: targets.filter((target) => target.enabled).length,
        protected_sources: protectedTargets.length,
        unprotected_discovered_sources: unprotectedDiscoveredSources.length,
        jobs_total: jobs.length,
        jobs_enabled: jobs.filter((job) => job.enabled).length,
        runs_tracked: recentRuns.length,
        runs_24h: recent24h.length,
        failed_24h: failed24h.length,
        restore_requests: restores.length,
        destinations_total: destinations.length,
        destinations_enabled: destinations.filter((destination) => destination.enabled).length,
        latest_status: latestRun?.status || 'none',
        latest_verification_status: latestRun?.verification_status || 'unknown',
        latest_success_at: latestSuccess?.completed_at || null,
        verification_pending: verificationPending.length,
        verification_failed: verificationFailed.length,
      },
      destinations,
      coverage_stats: this.coverageStats(targets, protectedTargets, unprotectedDiscoveredSources),
      unprotected_discovered_sources: unprotectedDiscoveredSources,
      source_contracts: this.sourceContracts(),
      coverage: targets.map((target) => {
        const targetJobs = jobsByTarget.get(target.id) || [];
        const targetRuns = recentRuns.filter((run) => targetJobs.some((job) => job.id === run.job_id));
        const lastRun = targetRuns[0];
        const lastSuccess = targetRuns.find((run) => run.status === BackupRunStatus.SUCCESS);
        const lastVerification = targetRuns.find((run) => Boolean(run.verification_status));
        return {
          target,
          jobs: targetJobs,
          protected: target.enabled && targetJobs.some((job) => job.enabled),
          last_run: lastRun ? this.serializeRun(lastRun) : null,
          last_success: lastSuccess ? this.serializeRun(lastSuccess) : null,
          last_verification: lastVerification ? {
            run_id: lastVerification.id,
            status: lastVerification.verification_status || VerificationStatus.UNKNOWN,
            checked_at: lastVerification.verification_checked_at || null,
            reason: lastVerification.verification_reason || null,
          } : null,
          failed_runs_24h: targetRuns.filter((run) => {
            return run.status === BackupRunStatus.FAILED
              && run.started_at
              && now - new Date(run.started_at).getTime() <= dayMs;
          }).length,
        };
      }),
      recent_runs: recentRuns.slice(0, 20).map((run) => this.serializeRun(run)),
      restore_requests: restores.slice(0, 20),
    };
  }

  private coverageStats(
    targets: BackupTarget[],
    protectedTargets: BackupTarget[],
    unprotectedDiscoveredSources: Array<Record<string, unknown>>,
  ) {
    const byCategory = new Map<string, { total: number; protected: number }>();
    for (const target of targets) {
      const category = String(target.source_category || 'postgres_database');
      const existing = byCategory.get(category) || { total: 0, protected: 0 };
      existing.total += 1;
      if (protectedTargets.some((protectedTarget) => protectedTarget.id === target.id)) existing.protected += 1;
      byCategory.set(category, existing);
    }
    for (const source of unprotectedDiscoveredSources) {
      const category = String(source.source_category || 'service');
      const existing = byCategory.get(category) || { total: 0, protected: 0 };
      existing.total += 1;
      byCategory.set(category, existing);
    }
    return Array.from(byCategory.entries()).map(([source_category, counts]) => ({ source_category, ...counts }));
  }

  private sourceContracts() {
    return [
      { source_category: 'postgres_database', restore_class: 'logical_postgres', execution_status: 'implemented', credential_policy: 'Vault or Kubernetes secret reference only' },
      { source_category: 'minio_bucket', restore_class: 'object_restore', execution_status: 'contract_only', credential_policy: 'No object-store credentials in Backups source, UI, or reports' },
      { source_category: 'kubernetes_resource', restore_class: 'manifest_reapply', execution_status: 'contract_only', credential_policy: 'Manifest metadata only; secret values remain owned by Vault/ESO' },
      { source_category: 'secret_reference', restore_class: 'secret_rehydration', execution_status: 'contract_only', credential_policy: 'References only; no secret values, private keys, or tokens' },
      { source_category: 'pvc', restore_class: 'volume_restore', execution_status: 'contract_only', credential_policy: 'Volume metadata and runbook references only' },
    ];
  }

  private unprotectedDiscoveredSources(discovery: any, targets: BackupTarget[]) {
    const services = Array.isArray(discovery?.services) ? discovery.services : [];
    return services
      .filter((service) => !targets.some((target) => this.matchesTarget(service, target)))
      .map((service) => ({
        name: service.name,
        namespace: service.namespace,
        host: service.host,
        source_category: service.backup_kind === 'postgres' ? 'postgres_database' : 'service',
        backup_ready: Boolean(service.backup_ready),
        reason: service.backup_ready
          ? 'Discovered PostgreSQL service has no backup target.'
          : 'Discovered service has no implemented backup source contract yet.',
      }));
  }

  private matchesTarget(service: any, target: BackupTarget) {
    return target.host === service.host
      || target.host === service.name
      || (target.name === service.name && target.kubernetes_namespace === service.namespace);
  }

  private serializeRun(run: BackupRun) {
    const { storage_path, walg_output, ...safeRun } = run as BackupRun & {
      storage_path?: string;
      walg_output?: string;
    };
    return safeRun;
  }

  private storageSettings() {
    return {
      backend: 'MinIO S3-compatible storage via WAL-G',
      bucket: process.env.MINIO_BUCKET || process.env.MINIO_BACKUP_BUCKET || 'backups',
      prefix: process.env.WALG_S3_PREFIX || 's3://backups',
      endpoint_configured: Boolean(process.env.WALG_S3_ENDPOINT || process.env.MINIO_ENDPOINT || process.env.MINIO_SERVICE_URL),
      compression: process.env.WALG_COMPRESSION_METHOD || 'lz4',
      default_schedule: process.env.BACKUP_SCHEDULE_DB || null,
      default_retention_days: process.env.BACKUP_RETENTION_DAYS || null,
    };
  }
}
