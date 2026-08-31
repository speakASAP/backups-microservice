import { RestoreStatus } from '../../src/restore/entities/restore-request.entity';
import { LOCK_NOT_AVAILABLE } from '../../src/common/backup-run-lock.service';

export const ACTIVE_STATUSES = [RestoreStatus.PENDING, RestoreStatus.RUNNING];

export function lockTimeoutError(): Error {
  const error = new Error('canceling statement due to lock timeout') as Error & { driverError: unknown };
  error.driverError = { code: LOCK_NOT_AVAILABLE };
  return error;
}

export interface LockTrace {
  event: 'lock_acquired' | 'lock_released' | string;
  run_id?: string;
}

export interface FakeLockOptions {
  /** Runs while the lock is held, immediately before the guarded work. */
  onAcquire?: (runId: string) => void | Promise<void>;
  /** Throw instead of granting the lock, e.g. to simulate a lock timeout. */
  reject?: (runId: string) => Error | null;
  trace?: LockTrace[];
}

/**
 * Stand-in for BackupRunLockService that runs the guarded work against a caller
 * supplied EntityManager double. `onAcquire` is the hook that makes a real race
 * reproducible: it mutates shared state at the exact instant the lock is granted,
 * which is the moment a competing writer would have committed just before the
 * holder's recheck.
 */
export function fakeRunLock(manager: unknown, options: FakeLockOptions = {}) {
  const trace = options.trace ?? [];
  const withBackupRunLock = jest.fn(async (runId: string, work: (manager: any) => Promise<unknown>) => {
    const rejection = options.reject ? options.reject(runId) : null;
    if (rejection) throw rejection;
    trace.push({ event: 'lock_acquired', run_id: runId });
    if (options.onAcquire) await options.onAcquire(runId);
    try {
      return await work(manager);
    } finally {
      trace.push({ event: 'lock_released', run_id: runId });
    }
  });
  return { withBackupRunLock, trace } as any;
}
