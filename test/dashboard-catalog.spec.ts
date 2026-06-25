import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DashboardService } from '../src/dashboard/dashboard.service';

describe('DashboardService disaster recovery catalog evidence', () => {
  const originalEnv = process.env;
  let tempDir: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'backups-dr-catalog-'));
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function repoMock(result: any[] = []) {
    return { find: jest.fn().mockResolvedValue(result) } as any;
  }

  function service() {
    return new DashboardService(
      repoMock(),
      repoMock(),
      repoMock(),
      repoMock(),
      repoMock(),
      { kubernetes: jest.fn().mockResolvedValue({ available: true, services: [], databases: [], workloads: [] }) } as any,
    );
  }

  it('returns sanitized catalog metadata without exposing do-not-touch secret material paths', async () => {
    const catalogPath = path.join(tempDir, 'latest.json');
    fs.writeFileSync(catalogPath, JSON.stringify({
      schema_version: 1,
      artifact: 'alfares_disaster_recovery_catalog',
      generated_at: '2026-06-25T18:41:54Z',
      generator: 'test',
      safety_policy: {
        classification: 'sanitized_metadata_only',
        raw_payload_contents_included: false,
        secret_values_included: false,
        kubernetes_secret_data_included: false,
        encrypted_archive_contents_included: false,
        destructive_actions_performed: false,
        schedule_or_mount_changes_performed: false,
      },
      mounts: [{ path: '/srv/critical-backups', device: '/dev/md0', status: 'proven_current_degraded_raid1' }],
      payload_families: [
        {
          id: 'database-server-current',
          family: 'database-server',
          current_path: '/srv/critical-backups/database-server',
          owner: 'database-server backup lane',
          category: 'current_protected_input',
          decision: 'move_after_checksum_and_gui_evidence_parity',
          target_state: '/srv/critical-backups/alfares-dr/database-server/daily',
          known_evidence: {
            run_id: '20260625_190924',
            evidence_manifest: '/home/ssf/Documents/Github/database-server/backup-evidence/latest.json',
            manifest_status: 'success',
          },
          restore_verification_status: '[UNKNOWN: not proven by Phase 0 catalog]',
          checksum_status: '[MISSING: collect only before copy/migration]',
          allowed_next_action: 'Index in Backups GUI before migration.',
        },
        {
          id: 'host-critical-secret-material',
          family: 'host-critical',
          current_path: '/srv/critical-backups/.backup-secret',
          owner: 'root-managed host critical backup lane',
          category: 'do_not_touch',
          decision: 'do_not_touch',
          target_state: '/srv/critical-backups/.backup-secret',
          known_evidence: {
            evidence_manifest: '/srv/critical-backups/.backup-secret/latest.json',
          },
          allowed_next_action: 'Do not read or display secret material.',
        },
      ],
      missing_or_awaiting_manifest_lanes: [{
        id: 'minio-snapshots',
        state: 'awaiting_manifest',
        reason: 'Live MinIO source data exists, but approved snapshot backup evidence is [MISSING].',
      }],
    }));
    process.env.DISASTER_RECOVERY_CATALOG_PATH = catalogPath;
    process.env.DATABASE_SERVER_BACKUP_EVIDENCE_PATH = path.join(tempDir, 'database-missing.json');
    process.env.VAULT_BACKUP_EVIDENCE_PATH = path.join(tempDir, 'vault-missing.json');

    const summary = await service().summary();
    const catalog = summary.external_evidence.disaster_recovery_catalog;

    expect(catalog.status).toBe('success');
    expect(catalog.payload_family_count).toBe(2);
    expect(catalog.missing_lane_count).toBe(1);
    expect(catalog.payload_families[0].current_path).toBe('/srv/critical-backups/database-server');
    expect(catalog.payload_families[1].current_path).toBe('[REDACTED: do-not-touch secret material path]');
    expect(catalog.payload_families[1].target_state).toBe('[REDACTED: do-not-touch secret material path]');
    expect(catalog.payload_families[1].known_evidence.evidence_manifest).toBe('[REDACTED: do-not-touch secret material path]');
    expect(JSON.stringify(catalog)).not.toContain('/srv/critical-backups/.backup-secret');
    expect(catalog.missing_or_awaiting_manifest_lanes[0].id).toBe('minio-snapshots');
    expect(catalog.safety_policy.secret_values_included).toBe(false);
  });
});
