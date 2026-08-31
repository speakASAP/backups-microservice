import { RestoreStatus } from '../src/restore/entities/restore-request.entity';
import {
  DEFAULT_PENDING_ABANDON_MS,
  DEFAULT_PENDING_ADOPT_MS,
  DEFAULT_RUNNING_STALE_MS,
  RestoreReconciliationService,
} from '../src/restore/restore-reconciliation.service';

const NOW = new Date('2026-08-31T12:00:00.000Z');
const requestId = '00000000-0000-4000-8000-000000000003';

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: requestId,
    target_id: '00000000-0000-4000-8000-000000000002',
    backup_run_id: '00000000-0000-4000-8000-000000000001',
    status: RestoreStatus.PENDING,
    created_at: ago(DEFAULT_PENDING_ADOPT_MS + 1_000),
    started_at: null,
    ...overrides,
  } as any;
}

function build(rows: any[], inFlight: string[] = []) {
  const repo = { find: jest.fn().mockResolvedValue(rows) } as any;
  const restore = {
    isInFlight: jest.fn((id: string) => inFlight.includes(id)),
    resumeExecution: jest.fn().mockResolvedValue(undefined),
    terminateStaleRequest: jest.fn().mockResolvedValue(true),
  } as any;
  const logger = { operation: jest.fn(), error: jest.fn() } as any;
  return { repo, restore, logger, service: new RestoreReconciliationService(repo, restore, logger) };
}

describe('RestoreReconciliationService', () => {
  const envKeys = ['RESTORE_PENDING_ADOPT_MS', 'RESTORE_PENDING_ABANDON_MS', 'RESTORE_RUNNING_STALE_MS'];
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) original[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key] as string;
    }
  });

  it('re-dispatches a pending request that no process is executing after a restart', async () => {
    const state = build([request()]);

    const summary = await state.service.reconcile(NOW);

    expect(state.restore.resumeExecution).toHaveBeenCalledWith(requestId);
    expect(state.restore.terminateStaleRequest).not.toHaveBeenCalled();
    expect(summary).toEqual(expect.objectContaining({ inspected: 1, redispatched: 1 }));
    expect(state.logger.operation).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'restore.reconcile.redispatched' }),
    );
  });

  it('leaves a freshly created pending request to its own dispatch', async () => {
    const state = build([request({ created_at: ago(1_000) })]);

    const summary = await state.service.reconcile(NOW);

    expect(state.restore.resumeExecution).not.toHaveBeenCalled();
    expect(summary).toEqual(expect.objectContaining({ skipped: 1, redispatched: 0 }));
  });

  it('never re-dispatches a request this process is already executing', async () => {
    const state = build([request()], [requestId]);

    const summary = await state.service.reconcile(NOW);

    expect(state.restore.resumeExecution).not.toHaveBeenCalled();
    expect(state.restore.terminateStaleRequest).not.toHaveBeenCalled();
    expect(summary).toEqual(expect.objectContaining({ skipped: 1 }));
  });

  it('fails an abandoned pending approval terminally instead of executing it late', async () => {
    const state = build([request({ created_at: ago(DEFAULT_PENDING_ABANDON_MS + 1_000) })]);

    const summary = await state.service.reconcile(NOW);

    expect(state.restore.resumeExecution).not.toHaveBeenCalled();
    expect(state.restore.terminateStaleRequest).toHaveBeenCalledWith(
      requestId,
      RestoreStatus.PENDING,
      expect.stringContaining('expired'),
    );
    expect(summary).toEqual(expect.objectContaining({ abandoned: 1 }));
  });

  it('fails an interrupted running request terminally and never re-runs it', async () => {
    const state = build([
      request({ status: RestoreStatus.RUNNING, started_at: ago(DEFAULT_RUNNING_STALE_MS + 1_000) }),
    ]);

    const summary = await state.service.reconcile(NOW);

    expect(state.restore.resumeExecution).not.toHaveBeenCalled();
    expect(state.restore.terminateStaleRequest).toHaveBeenCalledWith(
      requestId,
      RestoreStatus.RUNNING,
      expect.stringContaining('interrupted'),
    );
    expect(summary).toEqual(expect.objectContaining({ interrupted: 1 }));
  });

  it('leaves a running request alone while it is still inside the stale window', async () => {
    const state = build([
      request({ status: RestoreStatus.RUNNING, started_at: ago(60_000) }),
    ]);

    const summary = await state.service.reconcile(NOW);

    expect(state.restore.terminateStaleRequest).not.toHaveBeenCalled();
    expect(summary).toEqual(expect.objectContaining({ skipped: 1 }));
  });

  it('falls back to creation time for a running request with no start timestamp', async () => {
    const state = build([
      request({
        status: RestoreStatus.RUNNING,
        started_at: null,
        created_at: ago(DEFAULT_RUNNING_STALE_MS + 1_000),
      }),
    ]);

    const summary = await state.service.reconcile(NOW);

    expect(state.restore.terminateStaleRequest).toHaveBeenCalledWith(
      requestId,
      RestoreStatus.RUNNING,
      expect.any(String),
    );
    expect(summary).toEqual(expect.objectContaining({ interrupted: 1 }));
  });

  it('honours configured adopt, abandon, and stale windows', async () => {
    process.env.RESTORE_PENDING_ADOPT_MS = '1000';
    process.env.RESTORE_PENDING_ABANDON_MS = '5000';
    const state = build([request({ created_at: ago(6_000) })]);

    const summary = await state.service.reconcile(NOW);

    expect(state.restore.terminateStaleRequest).toHaveBeenCalledWith(
      requestId,
      RestoreStatus.PENDING,
      expect.any(String),
    );
    expect(summary).toEqual(expect.objectContaining({ abandoned: 1 }));
  });

  it('counts a refused recovery as skipped rather than resolved', async () => {
    const state = build([
      request({ status: RestoreStatus.RUNNING, started_at: ago(DEFAULT_RUNNING_STALE_MS + 1_000) }),
    ]);
    state.restore.terminateStaleRequest.mockResolvedValue(false);

    const summary = await state.service.reconcile(NOW);

    expect(summary).toEqual(expect.objectContaining({ interrupted: 0, skipped: 1 }));
  });

  it('never lets a reconciliation failure escape the scheduled sweep', async () => {
    const state = build([]);
    state.repo.find.mockRejectedValue(new Error('database unavailable'));

    await expect(state.service.scheduledReconcile()).resolves.toBeUndefined();
    expect(state.logger.error).toHaveBeenCalled();
  });
});
