import { BackupRunStatus, VerificationStatus } from '../src/backup/entities/backup-run.entity';
import { RestoreStatus } from '../src/restore/entities/restore-request.entity';
import { RetentionService } from '../src/retention/retention.service';
import { ACTIVE_STATUSES, fakeRunLock, lockTimeoutError, LockTrace } from './support/run-lock';

const logger = { operation: jest.fn() } as any;
const notifications = {
  retentionCleanupSucceeded: jest.fn(),
  retentionCleanupFailed: jest.fn(),
} as any;
const env = { WALG_S3_PREFIX: 's3://backups/db' } as any;
const job = { id: 'job-1', name: 'job', retention_full_count: 1 } as any;

const NEWEST = '00000000-0000-4000-8000-00000000000a';
const VERIFIED = '00000000-0000-4000-8000-00000000000b';
const EXPIRED = '00000000-0000-4000-8000-00000000000c';
const EXPIRED_TWO = '00000000-0000-4000-8000-00000000000d';

const PRESENT = { status: 'present', size: 4096, output: '' } as any;

function objectPath(id: string): string {
  return `s3://backups/db/logical/${id}.dump`;
}

function run(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    status: BackupRunStatus.SUCCESS,
    verification_status: VerificationStatus.PENDING,
    storage_path: objectPath(id),
    ...overrides,
  } as any;
}

interface BuildOptions {
  activeRestores?: any[];
  deleteResult?: { exitCode: number; output: string };
  probe?: any;
  onAcquire?: (runId: string, world: { runs: any[]; activeRestores: any[] }) => void;
  rejectLock?: (runId: string) => Error | null;
}

function build(runs: any[], options: BuildOptions = {}) {
  const activeRestores = options.activeRestores ?? [];
  const world = { runs, activeRestores };
  const trace: LockTrace[] = [];

  // The scheduler reads a snapshot; the locked recheck must read the row again.
  // Handing out copies is what makes a concurrent writer observable in the test.
  const runRepo = {
    find: jest.fn().mockImplementation(async () => runs.map((row) => ({ ...row }))),
    save: jest.fn().mockImplementation(async (value) => value),
  } as any;
  const restoreRepo = { find: jest.fn().mockResolvedValue(activeRestores) } as any;
  const walg = {
    deleteLogicalObject: jest.fn().mockImplementation(async (_env: any, name: string) => {
      trace.push({ event: `delete:${name}` });
      return options.deleteResult ?? { exitCode: 0, output: '' };
    }),
    probeLogicalObject: jest.fn().mockResolvedValue(options.probe ?? PRESENT),
  } as any;

  const manager = {
    findOne: jest.fn(async (_entity: any, query: any) => {
      const row = runs.find((candidate) => candidate.id === query.where.id);
      return row ? { ...row } : null;
    }),
    count: jest.fn(async (_entity: any, query: any) => activeRestores.filter(
      (request) => request.backup_run_id === query.where.backup_run_id && ACTIVE_STATUSES.includes(request.status),
    ).length),
    update: jest.fn(async (_entity: any, criteria: any, patch: any) => {
      const row = runs.find((candidate) => candidate.id === criteria.id);
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 };
    }),
  } as any;

  const lock = fakeRunLock(manager, {
    trace,
    reject: options.rejectLock,
    onAcquire: options.onAcquire ? (runId: string) => options.onAcquire!(runId, world) : undefined,
  });

  const service = new RetentionService(runRepo, restoreRepo, walg, notifications, logger, lock);
  return { service, runRepo, restoreRepo, walg, manager, lock, trace, world };
}

describe('RetentionService logical object cleanup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defers deletion until a verified backup exists', async () => {
    const state = build([run(NEWEST)]);

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
    expect(state.walg.probeLogicalObject).not.toHaveBeenCalled();
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({ event: 'retention.cleanup.deferred' }));
  });

  it('refuses a verified run with a null storage path as the safety anchor', async () => {
    const state = build([
      run(NEWEST),
      run(VERIFIED, { verification_status: VerificationStatus.VERIFIED, storage_path: null }),
      run(EXPIRED),
    ]);

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({ event: 'retention.cleanup.deferred' }));
  });

  it('refuses a verified run with a non-deterministic storage path as the safety anchor', async () => {
    const state = build([
      run(NEWEST),
      run(VERIFIED, {
        verification_status: VerificationStatus.VERIFIED,
        storage_path: 's3://backups/db/logical',
      }),
      run(EXPIRED),
    ]);

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({ event: 'retention.cleanup.deferred' }));
  });

  it('deletes only expired objects and keeps the newest verified backup', async () => {
    const runs = [
      run(NEWEST),
      run(VERIFIED, { verification_status: VerificationStatus.VERIFIED }),
      run(EXPIRED),
    ];
    const state = build(runs);

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).toHaveBeenCalledTimes(1);
    expect(state.walg.deleteLogicalObject).toHaveBeenCalledWith(env, `logical/${EXPIRED}.dump`);
    expect(runs[2].storage_path).toBeNull();
    expect(state.manager.update).toHaveBeenCalledWith(expect.anything(), { id: EXPIRED }, { storage_path: null });
  });

  it('never deletes a prefix, a foreign prefix, or a rewritten object path', async () => {
    const runs = [
      run(NEWEST),
      run(VERIFIED, { verification_status: VerificationStatus.VERIFIED }),
      run(EXPIRED, { storage_path: 's3://backups/db/logical' }),
      run(EXPIRED_TWO, { storage_path: 's3://other-bucket/db/logical/' + EXPIRED_TWO + '.dump' }),
    ];
    const state = build(runs);

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({ event: 'retention.cleanup.object_skipped' }));
    expect(notifications.retentionCleanupFailed).toHaveBeenCalled();
    expect(runs[2].storage_path).toBe('s3://backups/db/logical');
  });

  it('pins an object referenced by a pending or running restore request', async () => {
    const runs = [
      run(NEWEST),
      run(VERIFIED, { verification_status: VerificationStatus.VERIFIED }),
      run(EXPIRED),
      run(EXPIRED_TWO),
    ];
    const state = build(runs, { activeRestores: [{ backup_run_id: EXPIRED, status: RestoreStatus.PENDING }] });

    await state.service.cleanup(job, env);

    expect(state.restoreRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: expect.anything(), backup_run_id: expect.anything() }),
      }),
    );
    expect(state.walg.deleteLogicalObject).toHaveBeenCalledTimes(1);
    expect(state.walg.deleteLogicalObject).toHaveBeenCalledWith(env, `logical/${EXPIRED_TWO}.dump`);
    expect(runs[2].storage_path).toBe(objectPath(EXPIRED));
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({ event: 'retention.cleanup.object_pinned' }));
  });

  it('pins an object referenced by a running restore request', async () => {
    const runs = [
      run(NEWEST),
      run(VERIFIED, { verification_status: VerificationStatus.VERIFIED }),
      run(EXPIRED),
      run(EXPIRED_TWO),
    ];
    const state = build(runs, { activeRestores: [{ backup_run_id: EXPIRED, status: RestoreStatus.RUNNING }] });

    await state.service.cleanup(job, env);

    expect(state.restoreRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: expect.anything(), backup_run_id: expect.anything() }),
      }),
    );
    expect(state.walg.deleteLogicalObject).toHaveBeenCalledTimes(1);
    expect(state.walg.deleteLogicalObject).toHaveBeenCalledWith(env, `logical/${EXPIRED_TWO}.dump`);
    expect(runs[2].storage_path).toBe(objectPath(EXPIRED));
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({ event: 'retention.cleanup.object_pinned' }));
  });

  it('pins an object that is the source of an in-flight verification', async () => {
    const runs = [
      run(NEWEST),
      run(VERIFIED, { verification_status: VerificationStatus.VERIFIED }),
      run(EXPIRED, { verification_status: VerificationStatus.VERIFYING }),
    ];
    const state = build(runs);

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
    expect(runs[2].storage_path).toBe(objectPath(EXPIRED));
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({ event: 'retention.cleanup.object_pinned' }));
    expect(notifications.retentionCleanupSucceeded).toHaveBeenCalled();
  });
});

describe('RetentionService safety anchor storage proof', () => {
  beforeEach(() => jest.clearAllMocks());

  function anchoredRuns() {
    return [
      run(NEWEST),
      run(VERIFIED, { verification_status: VerificationStatus.VERIFIED }),
      run(EXPIRED),
    ];
  }

  it('probes the exact anchor object and never a prefix or the dump contents', async () => {
    const state = build(anchoredRuns());

    await state.service.cleanup(job, env);

    expect(state.walg.probeLogicalObject).toHaveBeenCalledTimes(1);
    expect(state.walg.probeLogicalObject).toHaveBeenCalledWith(env, `logical/${VERIFIED}.dump`);
    expect(logger.operation).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'retention.cleanup.anchor_verified' }),
    );
  });

  it('deletes nothing when the anchor object is absent from object storage', async () => {
    const state = build(anchoredRuns(), { probe: { status: 'absent', size: null, output: '' } });

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({
      event: 'retention.cleanup.deferred',
      metadata: expect.objectContaining({ anchor_probe: 'absent' }),
    }));
  });

  it('deletes nothing when the anchor probe is uncertain', async () => {
    const state = build(anchoredRuns(), { probe: { status: 'unknown', size: null, output: 'ERROR' } });

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
    expect(notifications.retentionCleanupSucceeded).not.toHaveBeenCalled();
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({
      event: 'retention.cleanup.deferred',
      metadata: expect.objectContaining({ anchor_probe: 'unknown' }),
    }));
  });
});

describe('RetentionService restore race', () => {
  beforeEach(() => jest.clearAllMocks());

  function racingRuns() {
    return [
      run(NEWEST),
      run(VERIFIED, { verification_status: VerificationStatus.VERIFIED }),
      run(EXPIRED),
    ];
  }

  it('holds the backup run lock across the recheck and the deletion', async () => {
    const state = build(racingRuns());

    await state.service.cleanup(job, env);

    const deleteIndex = state.trace.findIndex((entry) => entry.event === `delete:logical/${EXPIRED}.dump`);
    const acquiredIndex = state.trace.findIndex((entry) => entry.event === 'lock_acquired' && entry.run_id === EXPIRED);
    const releasedIndex = state.trace.findIndex((entry) => entry.event === 'lock_released' && entry.run_id === EXPIRED);

    expect(acquiredIndex).toBeGreaterThanOrEqual(0);
    expect(acquiredIndex).toBeLessThan(deleteIndex);
    expect(deleteIndex).toBeLessThan(releasedIndex);
  });

  it('keeps the object when a restore pins the run after the unlocked pre-check', async () => {
    const runs = racingRuns();
    const state = build(runs, {
      onAcquire: (runId, world) => {
        if (runId !== EXPIRED) return;
        world.activeRestores.push({ backup_run_id: EXPIRED, status: RestoreStatus.PENDING });
      },
    });

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
    expect(runs[2].storage_path).toBe(objectPath(EXPIRED));
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({
      event: 'retention.cleanup.object_pinned',
      metadata: expect.objectContaining({ recheck: 'locked' }),
    }));
    expect(notifications.retentionCleanupSucceeded).toHaveBeenCalled();
  });

  it('keeps the object when the run enters verifying after the unlocked pre-check', async () => {
    const runs = racingRuns();
    const state = build(runs, {
      onAcquire: (runId, world) => {
        if (runId !== EXPIRED) return;
        const target = world.runs.find((candidate) => candidate.id === EXPIRED);
        target.verification_status = VerificationStatus.VERIFYING;
      },
    });

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
    expect(runs[2].storage_path).toBe(objectPath(EXPIRED));
    expect(logger.operation).toHaveBeenCalledWith(expect.objectContaining({
      event: 'retention.cleanup.object_pinned',
      metadata: expect.objectContaining({ recheck: 'locked' }),
    }));
  });

  it('keeps the object when its storage path changed under the pre-check', async () => {
    const runs = racingRuns();
    const state = build(runs, {
      onAcquire: (runId, world) => {
        if (runId !== EXPIRED) return;
        world.runs.find((candidate) => candidate.id === EXPIRED).storage_path = null;
      },
    });

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
  });

  it('defers instead of deleting when the backup run lock is held by a restore', async () => {
    const runs = racingRuns();
    const state = build(runs, { rejectLock: (runId) => (runId === EXPIRED ? lockTimeoutError() : null) });

    await state.service.cleanup(job, env);

    expect(state.walg.deleteLogicalObject).not.toHaveBeenCalled();
    expect(runs[2].storage_path).toBe(objectPath(EXPIRED));
    expect(logger.operation).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'retention.cleanup.lock_unavailable' }),
    );
    expect(notifications.retentionCleanupFailed).toHaveBeenCalled();
  });
});
