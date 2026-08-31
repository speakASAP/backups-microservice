import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { BackupRun, BackupRunStatus, VerificationStatus } from '../src/backup/entities/backup-run.entity';
import { AuditAction } from '../src/audit/entities/audit-event.entity';
import { RestoreRequest, RestoreStatus } from '../src/restore/entities/restore-request.entity';
import { RestoreService, restoreIdempotencyKey } from '../src/restore/restore.service';
import {
  RESTORE_ACTIVE_TARGET_INDEX,
  RESTORE_IDEMPOTENCY_INDEX,
} from '../src/restore/restore-constraints';
import { SourceCategory } from '../src/targets/entities/backup-target.entity';
import { lockTimeoutError, LockTrace } from './support/run-lock';

const runId = '00000000-0000-4000-8000-000000000001';
const targetId = '00000000-0000-4000-8000-000000000002';
const requestId = '00000000-0000-4000-8000-000000000003';
const ACTIVE = [RestoreStatus.PENDING, RestoreStatus.RUNNING];

function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function uniqueViolation(constraint: string): Error {
  const error = new Error('duplicate key value violates unique constraint') as Error & { driverError: unknown };
  error.driverError = { code: '23505', constraint, detail: `Key already exists (${constraint}).` };
  return error;
}

function matches(expected: unknown, actual: unknown): boolean {
  if (expected === undefined) return true;
  const value = expected instanceof FindOperator ? expected.value : expected;
  return Array.isArray(value) ? value.includes(actual) : value === actual;
}

/** In-memory stand-in that enforces the same two unique indexes the migration creates. */
class FakeRestoreRepo {
  rows: any[] = [];
  sequence = 0;

  create = jest.fn((value: any) => ({ ...value }));

  save = jest.fn(async (entity: any) => {
    await tick();
    if (!entity.id) {
      if (entity.idempotency_key && this.rows.some((row) => row.idempotency_key === entity.idempotency_key)) {
        throw uniqueViolation(RESTORE_IDEMPOTENCY_INDEX);
      }
      if (ACTIVE.includes(entity.status)
        && this.rows.some((row) => row.target_id === entity.target_id && ACTIVE.includes(row.status))) {
        throw uniqueViolation(RESTORE_ACTIVE_TARGET_INDEX);
      }
      this.sequence += 1;
      entity.id = `request-${this.sequence}`;
      this.rows.push(entity);
      return entity;
    }
    const index = this.rows.findIndex((row) => row.id === entity.id);
    if (index >= 0) this.rows[index] = entity;
    else this.rows.push(entity);
    return entity;
  });

  findOne = jest.fn(async ({ where }: any) => {
    await tick();
    return (
      this.rows.find(
        (row) =>
          matches(where.id, row.id)
          && matches(where.idempotency_key, row.idempotency_key)
          && matches(where.target_id, row.target_id)
          && matches(where.status, row.status),
      ) ?? null
    );
  });

  find = jest.fn(async ({ where }: any = { where: {} }) => {
    await tick();
    return this.rows.filter((row) => matches(where?.status, row.status));
  });

  update = jest.fn(async (criteria: any, patch: any) => {
    await tick();
    const row = this.rows.find((candidate) => matches(criteria.id, candidate.id) && matches(criteria.status, candidate.status));
    if (!row) return { affected: 0 };
    Object.assign(row, patch);
    return { affected: 1 };
  });
}

function makeTarget(overrides: Record<string, unknown> = {}) {
  return {
    id: targetId,
    name: 'restore-target',
    source_category: SourceCategory.POSTGRES_DATABASE,
    host: 'restore-db',
    port: 5432,
    database_name: 'restored',
    ...overrides,
  } as any;
}

function makeBackupRun(overrides: Record<string, unknown> = {}) {
  return {
    id: runId,
    job_id: 'job-1',
    job: { target_id: targetId },
    status: BackupRunStatus.SUCCESS,
    verification_status: VerificationStatus.PENDING,
    storage_path: `s3://backups/restored/logical/${runId}.dump`,
    ...overrides,
  } as any;
}

interface FixtureOverrides {
  request?: any;
  backupRun?: any;
  target?: any;
  repo?: any;
  lockedRun?: any;
  rejectLock?: (runId: string) => Error | null;
  onAcquire?: (runId: string) => void;
}

function fixture(
  result = { exitCode: 0, output: 'logical_restore_object: dump\n' },
  overrides: FixtureOverrides = {},
) {
  const request = overrides.request ?? ({
    id: requestId,
    backup_run_id: runId,
    target_id: targetId,
    status: RestoreStatus.PENDING,
    requested_by: 'operator',
    approval_actor: 'owner',
    approval_reason: 'Approved synthetic restore validation.',
  } as any);
  const backupRun = overrides.backupRun ?? makeBackupRun();
  const target = overrides.target ?? makeTarget();
  const repo = overrides.repo ?? ({
    findOne: jest.fn().mockResolvedValue(request),
    find: jest.fn().mockResolvedValue([request]),
    save: jest.fn().mockImplementation(async (value) => value),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn((value: any) => ({ ...value })),
  } as any);
  const backupRunRepo = {
    save: jest.fn().mockImplementation(async (value) => value),
    findOne: jest.fn().mockImplementation(async () => overrides.lockedRun ?? backupRun),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  } as any;
  const backupService = { findOne: jest.fn().mockResolvedValue(backupRun) } as any;
  const targetsService = { findOne: jest.fn().mockResolvedValue(target) } as any;
  const env = { WALG_S3_PREFIX: 's3://backups/restored' } as any;
  const walg = {
    buildEnv: jest.fn().mockReturnValue(env),
    restoreFromObject: jest.fn().mockResolvedValue(result),
  } as any;
  const notifications = {
    restoreCompleted: jest.fn().mockResolvedValue(undefined),
    verificationVerified: jest.fn().mockResolvedValue(undefined),
    restoreFailed: jest.fn().mockResolvedValue(undefined),
    verificationFailed: jest.fn().mockResolvedValue(undefined),
  } as any;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as any;
  const logger = { operation: jest.fn(), error: jest.fn() } as any;
  const schemaReadiness = {
    assertRestoreSerializationReady: jest.fn(),
    getRestoreSerializationState: jest.fn(() => ({ ready: true, reason: 'ok', checked_at: null, duplicate_targets: 0 })),
  } as any;

  const route = (entity: unknown) => (entity === RestoreRequest ? repo : backupRunRepo);
  const manager = {
    create: (entity: unknown, value: any) => route(entity).create(value),
    save: (entity: unknown, value: any) => route(entity).save(value),
    findOne: (entity: unknown, options: any) => route(entity).findOne(options),
    update: (entity: unknown, criteria: any, patch: any) => route(entity).update(criteria, patch),
    getRepository: (entity: unknown) => route(entity),
  } as any;

  const trace: LockTrace[] = [];
  // Advisory locks are mutually exclusive per key, so the double must serialize
  // concurrent holders; otherwise a race test would prove nothing about the lock.
  const chains = new Map<string, Promise<unknown>>();
  const runLock = {
    /**
     * Models a real transaction: the guarded work either commits or, on any
     * failure, leaves no trace. That is what proves an audit failure cannot strand
     * a pending request in the target's single active slot.
     */
    withBackupRunLock: jest.fn((lockRunId: string, work: (manager: any) => Promise<unknown>) => {
      const held = chains.get(lockRunId) ?? Promise.resolve();
      const guarded = held.catch(() => undefined).then(async () => {
        const rejection = overrides.rejectLock ? overrides.rejectLock(lockRunId) : null;
        if (rejection) throw rejection;
        trace.push({ event: 'lock_acquired', run_id: lockRunId });
        if (overrides.onAcquire) overrides.onAcquire(lockRunId);
        const snapshot = repo instanceof FakeRestoreRepo ? repo.rows.slice() : null;
        try {
          return await work(manager);
        } catch (error) {
          if (snapshot && repo instanceof FakeRestoreRepo) repo.rows = snapshot;
          throw error;
        } finally {
          trace.push({ event: 'lock_released', run_id: lockRunId });
        }
      });
      chains.set(lockRunId, guarded.catch(() => undefined));
      return guarded;
    }),
  } as any;

  const service = new RestoreService(
    repo,
    backupRunRepo,
    backupService,
    targetsService,
    walg,
    notifications,
    audit,
    logger,
    runLock,
    schemaReadiness,
  );
  return {
    service, request, backupRun, target, repo, backupRunRepo, walg, notifications, audit, logger,
    runLock, schemaReadiness, manager, trace,
  };
}

function makeDto(overrides: Record<string, unknown> = {}) {
  return {
    backup_run_id: runId,
    target_id: targetId,
    approval_confirmed_backup_run_id: runId,
    approval_confirmed_target_id: targetId,
    approval_actor: 'owner',
    approval_reason: 'Approved synthetic restore validation.',
    production_restore_approved: true,
    ...overrides,
  } as any;
}

describe('RestoreService execution', () => {
  it('retrieves the deterministic object and restores into the exact target database', async () => {
    const state = fixture();

    await (state.service as any).executeRestore(requestId);

    expect(state.walg.buildEnv).toHaveBeenCalledWith(
      { storage_prefix: 's3://backups/restored' },
      state.target,
      expect.any(String),
    );
    expect(state.walg.restoreFromObject).toHaveBeenCalledWith(
      expect.objectContaining({ WALG_S3_PREFIX: 's3://backups/restored' }),
      `logical/${runId}.dump`,
      'restored',
    );
    expect(state.repo.update).toHaveBeenCalledWith(
      { id: requestId, status: RestoreStatus.PENDING },
      expect.objectContaining({ status: RestoreStatus.RUNNING }),
    );
    expect(state.request.status).toBe(RestoreStatus.COMPLETED);
    expect(state.backupRun.verification_status).toBe(VerificationStatus.VERIFIED);
    expect(state.audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.RESTORE_EXECUTION_COMPLETED,
      target_id: targetId,
      backup_run_id: runId,
    }), expect.anything());
  });

  it('persists auditable failure state when pg_restore fails', async () => {
    const state = fixture({ exitCode: 1, output: 'pg_restore: synthetic failure' });

    await (state.service as any).executeRestore(requestId);

    expect(state.request.status).toBe(RestoreStatus.FAILED);
    expect(state.request.error_message).toBe('pg_restore: synthetic failure');
    expect(state.backupRun.verification_status).toBe(VerificationStatus.FAILED);
    expect(state.audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.RESTORE_EXECUTION_FAILED,
      target_id: targetId,
      backup_run_id: runId,
    }), expect.anything());
    expect(state.notifications.restoreFailed).toHaveBeenCalled();
  });

  it('records validation failures instead of leaving requests pending', async () => {
    const state = fixture();
    state.backupRun.storage_path = 's3://backups/restored/logical/wrong.dump';

    await (state.service as any).executeRestore(requestId);

    expect(state.walg.restoreFromObject).not.toHaveBeenCalled();
    expect(state.request.status).toBe(RestoreStatus.FAILED);
    expect(state.backupRun.verification_status).toBe(VerificationStatus.FAILED);
    expect(state.audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.RESTORE_EXECUTION_FAILED,
    }), expect.anything());
  });

  it('records an exact-target mismatch without starting retrieval', async () => {
    const state = fixture();
    state.backupRun.job.target_id = '00000000-0000-4000-8000-000000000099';

    await (state.service as any).executeRestore(requestId);

    expect(state.walg.restoreFromObject).not.toHaveBeenCalled();
    expect(state.request.status).toBe(RestoreStatus.FAILED);
    expect(state.backupRun.verification_status).toBe(VerificationStatus.FAILED);
    expect(state.audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: AuditAction.RESTORE_EXECUTION_FAILED,
      target_id: targetId,
      backup_run_id: runId,
    }), expect.anything());
  });

  it.each([
    ['postgres://evil/db'],
    ['db=evil host=attacker'],
    ['--dbname=evil'],
    ['restored db'],
    ["restored\tdb"],
  ])('refuses to execute against database_name %p', async (databaseName) => {
    const state = fixture(undefined, { target: makeTarget({ database_name: databaseName }) });

    await (state.service as any).executeRestore(requestId);

    expect(state.walg.restoreFromObject).not.toHaveBeenCalled();
    expect(state.walg.buildEnv).not.toHaveBeenCalled();
    expect(state.request.status).toBe(RestoreStatus.FAILED);
    expect(state.backupRun.verification_status).toBe(VerificationStatus.FAILED);
  });

  it('never runs the same request twice when execution is re-entered', async () => {
    const repo = new FakeRestoreRepo();
    repo.rows.push({
      id: requestId,
      backup_run_id: runId,
      target_id: targetId,
      status: RestoreStatus.PENDING,
      requested_by: 'operator',
      approval_actor: 'owner',
      approval_reason: 'Approved synthetic restore validation.',
    });
    const state = fixture(undefined, { repo });

    await Promise.all([
      (state.service as any).executeRestore(requestId),
      (state.service as any).executeRestore(requestId),
    ]);

    expect(state.walg.restoreFromObject).toHaveBeenCalledTimes(1);
    expect(state.logger.operation).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'restore.request.claim_skipped' }),
    );
  });
});

describe('RestoreService retention race control', () => {
  it('pins the run by claiming it and marking it verifying inside one locked transaction', async () => {
    const state = fixture();

    await (state.service as any).executeRestore(requestId);

    expect(state.runLock.withBackupRunLock).toHaveBeenCalledWith(runId, expect.any(Function));
    expect(state.backupRunRepo.update).toHaveBeenCalledWith(
      { id: runId },
      expect.objectContaining({ verification_status: VerificationStatus.VERIFYING }),
    );

    const claimIndex = state.repo.update.mock.invocationCallOrder[0];
    const pinIndex = state.backupRunRepo.update.mock.invocationCallOrder[0];
    expect(claimIndex).toBeLessThan(pinIndex);
  });

  it('holds the run lock while the restore is claimed so retention cannot delete underneath it', async () => {
    const state = fixture();

    await (state.service as any).executeRestore(requestId);

    expect(state.trace.filter((entry) => entry.event === 'lock_acquired').length).toBeGreaterThanOrEqual(1);
    expect(state.trace[0]).toEqual({ event: 'lock_acquired', run_id: runId });
  });

  it('leaves the request pending for reconciliation when the run lock cannot be taken', async () => {
    const repo = new FakeRestoreRepo();
    repo.rows.push({
      id: requestId,
      backup_run_id: runId,
      target_id: targetId,
      status: RestoreStatus.PENDING,
      requested_by: 'operator',
      approval_actor: 'owner',
      approval_reason: 'Approved synthetic restore validation.',
    });
    const state = fixture(undefined, { repo, rejectLock: () => lockTimeoutError() });

    await (state.service as any).executeRestore(requestId);

    expect(state.walg.restoreFromObject).not.toHaveBeenCalled();
    expect(repo.rows[0].status).toBe(RestoreStatus.PENDING);
    expect(state.logger.operation).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'restore.request.claim_deferred' }),
    );
    expect(state.logger.operation).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'restore.request.claim_retry_pending' }),
    );
  });

  it('refuses to pin a backup run whose object retention already removed', async () => {
    const repo = new FakeRestoreRepo();
    const state = fixture(undefined, {
      repo,
      lockedRun: makeBackupRun({ storage_path: null }),
    });

    await expect(state.service.create(makeDto(), 'operator')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.rows).toHaveLength(0);
    expect(state.audit.record).not.toHaveBeenCalled();
  });

  it('refuses a restore request with 503 when the run lock is unavailable', async () => {
    const repo = new FakeRestoreRepo();
    const state = fixture(undefined, { repo, rejectLock: () => lockTimeoutError() });

    await expect(state.service.create(makeDto(), 'operator')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repo.rows).toHaveLength(0);
    expect(state.logger.operation).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'restore.request.lock_unavailable' }),
    );
  });
});

describe('RestoreService schema readiness gate', () => {
  it('refuses destructive restore traffic with 503 while serialization is degraded', async () => {
    const repo = new FakeRestoreRepo();
    const state = fixture(undefined, { repo });
    state.schemaReadiness.assertRestoreSerializationReady.mockImplementation(() => {
      throw new ServiceUnavailableException('Restore requests are unavailable: index missing');
    });

    await expect(state.service.create(makeDto(), 'operator')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repo.rows).toHaveLength(0);
    expect(state.audit.record).not.toHaveBeenCalled();
    expect(state.runLock.withBackupRunLock).not.toHaveBeenCalled();
  });
});

describe('RestoreService serialization and idempotency', () => {
  function createFixture(overrides: FixtureOverrides = {}) {
    const repo = new FakeRestoreRepo();
    const state = fixture(undefined, { repo, ...overrides });
    (state.service as any).executeRestore = jest.fn().mockResolvedValue(undefined);
    return { ...state, repo };
  }

  it('derives a stable idempotency key and reuses a supplied one', () => {
    const dto = makeDto();
    expect(restoreIdempotencyKey(dto, 'operator')).toBe(restoreIdempotencyKey(makeDto(), 'operator'));
    expect(restoreIdempotencyKey(dto, 'operator')).not.toBe(restoreIdempotencyKey(dto, 'other-operator'));
    expect(restoreIdempotencyKey(makeDto({ idempotency_key: 'client-key-1' }), 'operator')).toBe('client-key-1');
  });

  it('returns the original request for a repeated submission without a second execution', async () => {
    const state = createFixture();

    const first = await state.service.create(makeDto(), 'operator');
    const second = await state.service.create(makeDto(), 'operator');

    expect(second.id).toBe(first.id);
    expect(state.repo.rows).toHaveLength(1);
    expect((state.service as any).executeRestore).toHaveBeenCalledTimes(1);
    expect(state.logger.operation).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'restore.request.replayed' }),
    );
  });

  it('creates exactly one request when identical submissions race', async () => {
    const state = createFixture();

    const [first, second] = await Promise.all([
      state.service.create(makeDto(), 'operator'),
      state.service.create(makeDto(), 'operator'),
    ]);

    expect(state.repo.rows).toHaveLength(1);
    expect(first.id).toBe(second.id);
    expect((state.service as any).executeRestore).toHaveBeenCalledTimes(1);
  });

  it('lets the database serialize distinct restores that race for the same target', async () => {
    const state = createFixture();

    const results = await Promise.allSettled([
      state.service.create(makeDto({ idempotency_key: 'client-key-a' }), 'operator'),
      state.service.create(makeDto({ idempotency_key: 'client-key-b' }), 'operator'),
    ]);

    const fulfilled = results.filter((entry) => entry.status === 'fulfilled');
    const rejected = results.filter((entry) => entry.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    expect(state.repo.rows).toHaveLength(1);
    expect((state.service as any).executeRestore).toHaveBeenCalledTimes(1);
  });

  it('rejects a second restore while one is already pending for the target', async () => {
    const state = createFixture();

    await state.service.create(makeDto({ idempotency_key: 'client-key-a' }), 'operator');
    await expect(state.service.create(makeDto({ idempotency_key: 'client-key-b' }), 'operator')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(state.repo.rows).toHaveLength(1);
  });

  it('allows a new restore for the target once the previous one is terminal', async () => {
    const state = createFixture();

    const first = await state.service.create(makeDto({ idempotency_key: 'client-key-a' }), 'operator');
    first.status = RestoreStatus.FAILED;

    const second = await state.service.create(makeDto({ idempotency_key: 'client-key-b' }), 'operator');
    expect(second.id).not.toBe(first.id);
    expect(state.repo.rows).toHaveLength(2);
  });

  it('writes the pending request and its audit event in the same locked transaction', async () => {
    const state = createFixture();

    const request = await state.service.create(makeDto(), 'operator');

    expect(state.runLock.withBackupRunLock).toHaveBeenCalledWith(runId, expect.any(Function));
    expect(state.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.RESTORE_REQUEST_CREATED,
        restore_request_id: request.id,
      }),
      state.manager,
    );
    const released = state.trace.findIndex((entry) => entry.event === 'lock_released');
    expect(released).toBeGreaterThan(0);
  });

  it('rolls the pending request back when its audit event cannot be written', async () => {
    const state = createFixture();
    state.audit.record.mockRejectedValueOnce(new Error('audit_events insert failed'));

    await expect(state.service.create(makeDto({ idempotency_key: 'client-key-a' }), 'operator'))
      .rejects.toThrow('audit_events insert failed');

    expect(state.repo.rows).toHaveLength(0);
    expect((state.service as any).executeRestore).not.toHaveBeenCalled();

    // The target must not be blocked by the failed attempt.
    const recovered = await state.service.create(makeDto({ idempotency_key: 'client-key-b' }), 'operator');
    expect(recovered.status).toBe(RestoreStatus.PENDING);
    expect(state.repo.rows).toHaveLength(1);
  });
});

describe('RestoreService stranded request recovery', () => {
  function strandedFixture(status: RestoreStatus, overrides: Record<string, unknown> = {}) {
    const repo = new FakeRestoreRepo();
    const row = {
      id: requestId,
      backup_run_id: runId,
      target_id: targetId,
      status,
      requested_by: 'operator',
      approval_actor: 'owner',
      approval_reason: 'Approved synthetic restore validation.',
      created_at: new Date('2026-08-30T00:00:00.000Z'),
      started_at: status === RestoreStatus.RUNNING ? new Date('2026-08-30T00:00:00.000Z') : null,
      ...overrides,
    } as any;
    repo.rows.push(row);
    return { ...fixture(undefined, { repo }), repo, row };
  }

  it('fails an interrupted running request terminally with audit and notification evidence', async () => {
    const state = strandedFixture(RestoreStatus.RUNNING);

    const recovered = await state.service.terminateStaleRequest(
      requestId,
      RestoreStatus.RUNNING,
      'Restore execution was interrupted before it reported an outcome.',
    );

    expect(recovered).toBe(true);
    expect(state.repo.rows[0].status).toBe(RestoreStatus.FAILED);
    expect(state.repo.rows[0].error_message).toContain('interrupted');
    expect(state.walg.restoreFromObject).not.toHaveBeenCalled();
    expect(state.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.RESTORE_EXECUTION_FAILED,
        metadata: expect.objectContaining({ recovery: 'interrupted_execution' }),
      }),
      expect.anything(),
    );
    expect(state.notifications.restoreFailed).toHaveBeenCalled();
    expect(state.logger.operation).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'restore.request.recovered' }),
    );
  });

  it('fails an abandoned pending request without ever executing it', async () => {
    const state = strandedFixture(RestoreStatus.PENDING);

    const recovered = await state.service.terminateStaleRequest(
      requestId,
      RestoreStatus.PENDING,
      'Restore approval expired before execution started.',
    );

    expect(recovered).toBe(true);
    expect(state.repo.rows[0].status).toBe(RestoreStatus.FAILED);
    expect(state.walg.restoreFromObject).not.toHaveBeenCalled();
    expect(state.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ recovery: 'abandoned_approval' }) }),
      expect.anything(),
    );
  });

  it('refuses to terminate a request this process is still executing', async () => {
    const state = strandedFixture(RestoreStatus.RUNNING);
    (state.service as any).inFlight.add(requestId);

    const recovered = await state.service.terminateStaleRequest(requestId, RestoreStatus.RUNNING, 'interrupted');

    expect(recovered).toBe(false);
    expect(state.repo.rows[0].status).toBe(RestoreStatus.RUNNING);
    expect(state.audit.record).not.toHaveBeenCalled();
  });

  it('refuses to terminate a request that already reached a terminal status', async () => {
    const state = strandedFixture(RestoreStatus.COMPLETED);

    const recovered = await state.service.terminateStaleRequest(requestId, RestoreStatus.RUNNING, 'interrupted');

    expect(recovered).toBe(false);
    expect(state.repo.rows[0].status).toBe(RestoreStatus.COMPLETED);
  });

  it('reports in-flight execution so recovery can tell a live restore from an abandoned one', async () => {
    const repo = new FakeRestoreRepo();
    repo.rows.push({
      id: requestId,
      backup_run_id: runId,
      target_id: targetId,
      status: RestoreStatus.PENDING,
      requested_by: 'operator',
      approval_actor: 'owner',
      approval_reason: 'Approved synthetic restore validation.',
    });
    const state = fixture(undefined, { repo });
    let observed = false;
    state.walg.restoreFromObject.mockImplementation(async () => {
      observed = state.service.isInFlight(requestId);
      return { exitCode: 0, output: 'ok' };
    });

    expect(state.service.isInFlight(requestId)).toBe(false);
    await state.service.resumeExecution(requestId);

    expect(observed).toBe(true);
    expect(state.service.isInFlight(requestId)).toBe(false);
  });
});
