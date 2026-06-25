import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
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
      external_evidence: this.externalEvidence(),
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
      { source_category: 'vault_secrets', restore_class: 'secret_rehydration', execution_status: 'evidence_slot', credential_policy: 'Sanitized manifest only; no Vault keys, tokens, or secret values' },
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


  private externalEvidence() {
    return {
      database_server: this.readJsonEvidence(
        'database-server',
        process.env.DATABASE_SERVER_BACKUP_EVIDENCE_PATH || '/var/lib/backups-evidence/database-server/latest.json',
      ),
      disaster_recovery_catalog: this.readDisasterRecoveryCatalog(
        process.env.DISASTER_RECOVERY_CATALOG_PATH || '/var/lib/backups-evidence/disaster-recovery/latest.json',
      ),
      vault: this.readVaultEvidence(),
    };
  }

  private readDisasterRecoveryCatalog(manifestPath: string) {
    try {
      if (!fs.existsSync(manifestPath)) {
        return {
          source: 'disaster-recovery-catalog',
          source_category: 'disaster_recovery_catalog',
          backup_type: 'alfares_disaster_recovery_catalog',
          available: false,
          status: 'missing',
          manifest_path: manifestPath,
          reason: 'Disaster recovery catalog evidence manifest is not present.',
          secret_policy: 'Catalog evidence only; secret values, Kubernetes Secret data, dump contents, and encrypted archive contents are not exposed.',
        };
      }

      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const payloadFamilies = Array.isArray(parsed.payload_families) ? parsed.payload_families : [];
      const missingLanes = Array.isArray(parsed.missing_or_awaiting_manifest_lanes)
        ? parsed.missing_or_awaiting_manifest_lanes
        : [];
      const mounts = Array.isArray(parsed.mounts) ? parsed.mounts : [];

      return {
        source: 'disaster-recovery-catalog',
        source_category: 'disaster_recovery_catalog',
        backup_type: parsed.artifact || 'alfares_disaster_recovery_catalog',
        available: true,
        status: parsed.schema_version ? 'success' : 'unknown',
        generated_at: parsed.generated_at || null,
        generator: parsed.generator || null,
        schema_version: parsed.schema_version || null,
        manifest_path: manifestPath,
        payload_family_count: payloadFamilies.length,
        missing_lane_count: missingLanes.length,
        payload_families: payloadFamilies.map((family) => this.sanitizeCatalogFamily(family)),
        missing_or_awaiting_manifest_lanes: missingLanes.map((lane) => ({
          id: lane?.id || null,
          state: lane?.state || 'unknown',
          reason: lane?.reason || '[UNKNOWN: missing lane reason]',
        })),
        mounts: mounts.map((mount) => ({
          path: mount?.path || null,
          device: mount?.device || null,
          filesystem: mount?.filesystem || null,
          role: mount?.role || null,
          status: mount?.status || 'unknown',
          next_action: mount?.next_action || null,
        })),
        safety_policy: this.sanitizeCatalogSafetyPolicy(parsed.safety_policy || {}),
        secret_policy: 'Sanitized catalog metadata only; secret values, Kubernetes Secret .data, dump contents, encrypted archive contents, and do-not-touch secret-material paths are not exposed.',
      };
    } catch (error) {
      return {
        source: 'disaster-recovery-catalog',
        source_category: 'disaster_recovery_catalog',
        backup_type: 'alfares_disaster_recovery_catalog',
        available: false,
        status: 'error',
        manifest_path: manifestPath,
        reason: error instanceof Error ? error.message : 'Unable to read disaster recovery catalog evidence.',
        secret_policy: 'Catalog evidence only; secret values, Kubernetes Secret data, dump contents, and encrypted archive contents are not exposed.',
      };
    }
  }

  private sanitizeCatalogFamily(family: any) {
    const currentPath = this.catalogPathAllowed(family)
      ? this.sanitizeCatalogPathReference(family.current_path || null)
      : '[REDACTED: do-not-touch secret material path]';

    return {
      id: family?.id || null,
      family: family?.family || null,
      category: family?.category || null,
      owner: family?.owner || null,
      decision: family?.decision || null,
      current_path: currentPath,
      target_state: this.sanitizeCatalogPathReference(family?.target_state || null),
      restore_verification_status: family?.restore_verification_status || '[UNKNOWN: not reported]',
      checksum_status: family?.checksum_status || '[UNKNOWN: not reported]',
      allowed_next_action: family?.allowed_next_action || '[UNKNOWN: no next action recorded]',
      known_evidence: this.sanitizeCatalogKnownEvidence(family?.known_evidence || {}),
    };
  }

  private catalogPathAllowed(family: any) {
    const id = String(family?.id || '').toLowerCase();
    const category = String(family?.category || '').toLowerCase();
    const currentPath = String(family?.current_path || '').toLowerCase();
    return !id.includes('secret-material')
      && !category.includes('do_not_touch')
      && !currentPath.includes('.backup-secret');
  }

  private sanitizeCatalogKnownEvidence(evidence: any) {
    return {
      run_id: evidence?.run_id || null,
      reported_size_human: evidence?.reported_size_human || null,
      observed_directory_size_human: evidence?.observed_directory_size_human || null,
      evidence_manifest: this.sanitizeCatalogPathReference(evidence?.evidence_manifest || null),
      manifest_status: evidence?.manifest_status || null,
      manifest_generated_at: evidence?.manifest_generated_at || null,
    };
  }

  private sanitizeCatalogPathReference(value: string | null) {
    if (!value) return null;
    const lowered = String(value).toLowerCase();
    if (lowered.includes('.backup-secret') || lowered.includes('secret-material')) {
      return '[REDACTED: do-not-touch secret material path]';
    }
    return value;
  }

  private sanitizeCatalogSafetyPolicy(policy: any) {
    return {
      classification: policy?.classification || 'sanitized_metadata_only',
      raw_payload_contents_included: Boolean(policy?.raw_payload_contents_included),
      secret_values_included: Boolean(policy?.secret_values_included),
      kubernetes_secret_data_included: Boolean(policy?.kubernetes_secret_data_included),
      encrypted_archive_contents_included: Boolean(policy?.encrypted_archive_contents_included),
      destructive_actions_performed: Boolean(policy?.destructive_actions_performed),
      schedule_or_mount_changes_performed: Boolean(policy?.schedule_or_mount_changes_performed),
    };
  }

  private readVaultEvidence() {
    const jsonPath = process.env.VAULT_BACKUP_EVIDENCE_PATH || '/var/lib/backups-evidence/vault/latest.json';
    const jsonEvidence = this.readJsonEvidence('vault', jsonPath);
    if (jsonEvidence.available) return jsonEvidence;

    const legacyPath = process.env.VAULT_BACKUP_MANIFEST_PATH;
    if (!legacyPath) {
      return {
        source: 'vault',
        source_category: 'vault_secrets',
        available: false,
        status: 'awaiting_manifest',
        manifest_path: jsonPath,
        reason: jsonEvidence.reason,
      };
    }

    try {
      if (!fs.existsSync(legacyPath)) {
        return {
          source: 'vault',
          source_category: 'vault_secrets',
          available: false,
          status: 'missing',
          manifest_path: legacyPath,
          reason: 'Vault backup manifest is not present.',
        };
      }
      const lines = fs.readFileSync(legacyPath, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
      const latest = lines[lines.length - 1] || '';
      return {
        source: 'vault',
        source_category: 'vault_secrets',
        backup_type: 'vault_snapshot',
        available: Boolean(latest),
        status: latest ? 'success' : 'unknown',
        manifest_path: legacyPath,
        latest_entry: latest || null,
        secret_policy: 'Vault manifest status only; secret values, unseal keys, tokens, and backup payloads are never exposed.',
      };
    } catch (error) {
      return {
        source: 'vault',
        source_category: 'vault_secrets',
        available: false,
        status: 'error',
        manifest_path: legacyPath,
        reason: error instanceof Error ? error.message : 'Unable to read Vault backup evidence.',
      };
    }
  }

  private readJsonEvidence(source: string, manifestPath: string) {
    try {
      if (!fs.existsSync(manifestPath)) {
        return { source, available: false, status: 'missing', manifest_path: manifestPath, reason: 'Evidence manifest is not present.' };
      }
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      return {
        source,
        source_category: parsed.source_category || (source === 'vault' ? 'vault_secrets' : 'postgres_database'),
        backup_type: parsed.backup_type || 'external_manifest',
        available: true,
        status: parsed.status || 'unknown',
        generated_at: parsed.generated_at || null,
        backup_timestamp: parsed.backup_timestamp || null,
        database_count: parsed.database_count || 0,
        databases: Array.isArray(parsed.databases) ? parsed.databases.slice(0, 120) : [],
        artifact_count: parsed.artifact_count || 0,
        artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts.map((artifact) => ({
          name: artifact.name,
          kind: artifact.kind,
          size_bytes: artifact.size_bytes,
        })) : [],
        storage: parsed.storage ? {
          backup_dir: parsed.storage.backup_dir,
          run_dir: parsed.storage.run_dir,
          retention_days: parsed.storage.retention_days,
        } : null,
        manifest_path: manifestPath,
        secret_policy: parsed.secret_policy || 'Evidence manifest is sanitized before UI display.',
      };
    } catch (error) {
      return { source, available: false, status: 'error', manifest_path: manifestPath, reason: error instanceof Error ? error.message : 'Unable to read evidence manifest.' };
    }
  }
}
