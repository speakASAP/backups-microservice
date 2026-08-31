import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import { spawn } from 'child_process';
import {
  assertLogicalBackupObjectName,
  isLogicalBackupObjectName,
  logicalBackupObjectName,
  logicalBackupStoragePath,
  relativeStorageObject,
  WalgWrapperService,
} from '../src/backup/walg-wrapper.service';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

const mockLogger = { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } as any;
const spawnMock = spawn as jest.MockedFunction<typeof spawn>;
const runId = '00000000-0000-4000-8000-000000000001';
const objectName = `logical/${runId}.dump`;

function mockProcess() {
  const process = new EventEmitter() as any;
  process.stdout = new PassThrough();
  process.stderr = new PassThrough();
  process.stdin = new PassThrough();
  process.kill = jest.fn();
  return process;
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Every spawn after the two piped children is the best-effort partial-object cleanup. */
function autoClosingCleanup() {
  const proc = mockProcess();
  setImmediate(() => proc.emit('close', 0));
  return proc as any;
}

describe('WalgWrapperService', () => {
  let service: WalgWrapperService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WalgWrapperService(mockLogger);
  });

  it('buildEnv constructs correct S3 prefix from storage_prefix', () => {
    const env = service.buildEnv(
      { storage_prefix: 's3://backups/mydb' },
      { host: 'db-server-postgres', port: 5432, database_name: 'mydb' },
      'secret',
    );
    expect(env.WALG_S3_PREFIX).toBe('s3://backups/mydb');
    expect(env.PGHOST).toBe('db-server-postgres');
    expect(env.PGDATABASE).toBe('mydb');
    expect(env.PGPASSWORD).toBe('secret');
    expect(env.AWS_S3_FORCE_PATH_STYLE).toBe('true');
  });

  it('buildEnv falls back to database_name when no storage_prefix', () => {
    process.env.WALG_S3_PREFIX = 's3://backups';
    const env = service.buildEnv(
      {},
      { host: 'localhost', port: 5432, database_name: 'notifications' },
      'pw',
    );
    expect(env.WALG_S3_PREFIX).toBe('s3://backups/notifications');
  });

  it('buildEnv rejects unsafe database names at the execution boundary', () => {
    expect(() => service.buildEnv({}, { host: 'db', port: 5432, database_name: 'postgres://evil/db' }, 'pw')).toThrow();
    expect(() => service.buildEnv({}, { host: 'db', port: 5432, database_name: '--help' }, 'pw')).toThrow();
    expect(() => service.buildEnv({}, { host: 'db', port: 5432, database_name: 'db name' }, 'pw')).toThrow();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('builds safe logical backup object paths', () => {
    expect(logicalBackupObjectName(runId)).toBe(objectName);
    expect(logicalBackupStoragePath('s3://backups/mydb/', objectName)).toBe(`s3://backups/mydb/${objectName}`);
    expect(relativeStorageObject('s3://backups/mydb', `s3://backups/mydb/${objectName}`)).toBe(objectName);
    expect(() => logicalBackupObjectName('../bad')).toThrow();
    expect(() => relativeStorageObject('s3://backups/mydb', 's3://other/object')).toThrow();
  });

  it('recognises only the exact deterministic logical object name', () => {
    expect(isLogicalBackupObjectName(objectName)).toBe(true);
    expect(isLogicalBackupObjectName('logical')).toBe(false);
    expect(isLogicalBackupObjectName('logical/')).toBe(false);
    expect(isLogicalBackupObjectName(`logical/${runId}`)).toBe(false);
    expect(isLogicalBackupObjectName(`logical/${runId}.dump/child`)).toBe(false);
    expect(isLogicalBackupObjectName(`other/${runId}.dump`)).toBe(false);
    expect(isLogicalBackupObjectName(null)).toBe(false);
    expect(() => assertLogicalBackupObjectName('logical')).toThrow();
  });

  it('streams pg_dump output to a supported WAL-G storage command', async () => {
    const dump = mockProcess();
    const upload = mockProcess();
    spawnMock.mockReturnValueOnce(dump).mockReturnValueOnce(upload);
    const env = service.buildEnv(
      { storage_prefix: 's3://backups/mydb' },
      { host: 'db-server-postgres', port: 5432, database_name: 'mydb' },
      'secret',
    );

    const resultPromise = service.backupPush(env, objectName);
    await flush();
    dump.stdout.end(Buffer.from([0, 1, 2, 3]));
    dump.emit('close', 0);
    upload.emit('close', 0);

    await expect(resultPromise).resolves.toEqual({
      exitCode: 0,
      output: `logical_backup_object: ${objectName}\n`,
    });
    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      'pg_dump',
      ['--format=custom', '--no-owner', '--no-privileges', '--no-password'],
      expect.objectContaining({ env: expect.objectContaining({ PGDATABASE: 'mydb' }) }),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      'wal-g',
      ['st', 'put', '--read-stdin', '--no-compress', objectName],
      expect.objectContaining({ env: expect.objectContaining({ WALG_S3_PREFIX: 's3://backups/mydb' }) }),
    );
  });

  it('fails the pipeline when the dump producer fails', async () => {
    const dump = mockProcess();
    const upload = mockProcess();
    spawnMock
      .mockReturnValueOnce(dump)
      .mockReturnValueOnce(upload)
      .mockImplementation(autoClosingCleanup);
    const env = service.buildEnv({}, { host: 'db', port: 5432, database_name: 'db' }, 'secret');

    const resultPromise = service.backupPush(env, objectName);
    await flush();
    dump.stderr.write('connection failed');
    dump.stdout.destroy();
    dump.emit('close', 1);
    upload.emit('close', null);

    const result = await resultPromise;
    expect(result.exitCode).toBe(1);
    expect(upload.kill).toHaveBeenCalledWith('SIGTERM');
    expect(result.output).toContain(`partial_object_cleanup: removed ${objectName}`);
    expect(spawnMock).toHaveBeenLastCalledWith('wal-g', ['st', 'rm', '--glob', objectName], expect.anything());
  });

  it('fails the backup pipeline and terminates both children when the stream errors', async () => {
    const dump = mockProcess();
    const upload = mockProcess();
    spawnMock
      .mockReturnValueOnce(dump)
      .mockReturnValueOnce(upload)
      .mockImplementation(autoClosingCleanup);
    const env = service.buildEnv({}, { host: 'db', port: 5432, database_name: 'db' }, 'secret');

    const resultPromise = service.backupPush(env, objectName);
    await flush();
    dump.stdout.write(Buffer.from([0, 1, 2, 3]));
    upload.stdin.destroy(new Error('EPIPE upload transport failed'));
    await flush();

    expect(dump.kill).toHaveBeenCalledWith('SIGTERM');
    expect(upload.kill).toHaveBeenCalledWith('SIGTERM');

    dump.emit('close', 0);
    upload.emit('close', 0);

    const result = await resultPromise;
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('stream failed');
    expect(result.output).not.toContain('logical_backup_object');
  });

  it('fails the backup pipeline when the upload consumer closes its input prematurely', async () => {
    const dump = mockProcess();
    const upload = mockProcess();
    spawnMock
      .mockReturnValueOnce(dump)
      .mockReturnValueOnce(upload)
      .mockImplementation(autoClosingCleanup);
    const env = service.buildEnv({}, { host: 'db', port: 5432, database_name: 'db' }, 'secret');

    const resultPromise = service.backupPush(env, objectName);
    await flush();
    dump.stdout.write(Buffer.from([9, 9, 9]));
    upload.stdin.destroy();
    await flush();

    dump.emit('close', 0);
    upload.emit('close', 0);

    const result = await resultPromise;
    expect(result.exitCode).toBe(1);
    expect(dump.kill).toHaveBeenCalledWith('SIGTERM');
    expect(upload.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('cannot resolve success when both children close before a premature stream close is reported', async () => {
    const dump = mockProcess();
    const upload = mockProcess();
    spawnMock
      .mockReturnValueOnce(dump)
      .mockReturnValueOnce(upload)
      .mockImplementation(autoClosingCleanup);
    const env = service.buildEnv({}, { host: 'db', port: 5432, database_name: 'db' }, 'secret');

    const resultPromise = service.backupPush(env, objectName);
    await flush();
    dump.stdout.write(Buffer.from([7, 7, 7]));
    upload.stdin.destroy();

    // Child close events can arrive before stream.pipeline reports
    // ERR_STREAM_PREMATURE_CLOSE. They must not win the success race.
    dump.emit('close', 0);
    upload.emit('close', 0);

    const result = await resultPromise;
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('stream failed');
    expect(result.output).not.toContain('logical_backup_object');
    expect(spawnMock).toHaveBeenLastCalledWith('wal-g', ['st', 'rm', '--glob', objectName], expect.anything());
  });

  it('streams a WAL-G object into pg_restore without buffering archive bytes', async () => {
    const fetch = mockProcess();
    const restore = mockProcess();
    spawnMock.mockReturnValueOnce(fetch).mockReturnValueOnce(restore);
    const env = service.buildEnv(
      { storage_prefix: 's3://backups/mydb' },
      { host: 'restore-db', port: 5432, database_name: 'restored' },
      'secret',
    );

    const resultPromise = service.restoreFromObject(env, objectName, 'restored');
    await flush();
    fetch.stdout.end(Buffer.from([0, 255, 1, 254]));
    fetch.emit('close', 0);
    restore.emit('close', 0);

    await expect(resultPromise).resolves.toEqual({
      exitCode: 0,
      output: `logical_restore_object: ${objectName}\n`,
    });
    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      'wal-g',
      ['st', 'cat', objectName],
      expect.objectContaining({ env: expect.objectContaining({ WALG_S3_PREFIX: 's3://backups/mydb' }) }),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      'pg_restore',
      [
        '--dbname=restored',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        '--exit-on-error',
        '--single-transaction',
      ],
      expect.objectContaining({ env: expect.objectContaining({ PGHOST: 'restore-db', PGDATABASE: 'restored' }) }),
    );
  });

  it('fails the restore pipeline and terminates both children when the stream errors', async () => {
    const fetch = mockProcess();
    const restore = mockProcess();
    spawnMock.mockReturnValueOnce(fetch).mockReturnValueOnce(restore);
    const env = service.buildEnv({}, { host: 'restore-db', port: 5432, database_name: 'restored' }, 'secret');

    const resultPromise = service.restoreFromObject(env, objectName, 'restored');
    await flush();
    fetch.stdout.write(Buffer.from([1, 2, 3]));
    restore.stdin.destroy(new Error('EPIPE pg_restore exited early'));
    await flush();

    expect(fetch.kill).toHaveBeenCalledWith('SIGTERM');
    expect(restore.kill).toHaveBeenCalledWith('SIGTERM');

    fetch.emit('close', 0);
    restore.emit('close', 0);

    const result = await resultPromise;
    expect(result.exitCode).toBe(1);
    expect(result.output).not.toContain('logical_restore_object');
  });



  it('fails the restore pipeline when pg_restore closes its input prematurely despite zero child exits', async () => {
    const fetch = mockProcess();
    const restore = mockProcess();
    spawnMock.mockReturnValueOnce(fetch).mockReturnValueOnce(restore);
    const env = service.buildEnv({}, { host: 'restore-db', port: 5432, database_name: 'restored' }, 'secret');

    const resultPromise = service.restoreFromObject(env, objectName, 'restored');
    await flush();
    fetch.stdout.write(Buffer.from([4, 5, 6]));
    restore.stdin.destroy();
    await flush();

    fetch.emit('close', 0);
    restore.emit('close', 0);

    const result = await resultPromise;
    expect(result.exitCode).toBe(1);
    expect(fetch.kill).toHaveBeenCalledWith('SIGTERM');
    expect(restore.kill).toHaveBeenCalledWith('SIGTERM');
    expect(result.output).not.toContain('logical_restore_object');
  });

  it('fails the restore pipeline when the WAL-G source stream errors despite zero child exits', async () => {
    const fetch = mockProcess();
    const restore = mockProcess();
    spawnMock.mockReturnValueOnce(fetch).mockReturnValueOnce(restore);
    const env = service.buildEnv({}, { host: 'restore-db', port: 5432, database_name: 'restored' }, 'secret');

    const resultPromise = service.restoreFromObject(env, objectName, 'restored');
    await flush();
    fetch.stdout.destroy(new Error('synthetic WAL-G source failure'));
    await flush();

    fetch.emit('close', 0);
    restore.emit('close', 0);

    const result = await resultPromise;
    expect(result.exitCode).toBe(1);
    expect(fetch.kill).toHaveBeenCalledWith('SIGTERM');
    expect(restore.kill).toHaveBeenCalledWith('SIGTERM');
    expect(result.output).toContain('stream failed');
  });

  it('refuses to spawn a restore for a non-deterministic object or unsafe database', async () => {
    const env = service.buildEnv({}, { host: 'restore-db', port: 5432, database_name: 'restored' }, 'secret');

    await expect(service.restoreFromObject(env, 'logical', 'restored')).resolves.toEqual(
      expect.objectContaining({ exitCode: 1 }),
    );
    await expect(service.restoreFromObject(env, objectName, '--dbname=evil')).resolves.toEqual(
      expect.objectContaining({ exitCode: 1 }),
    );
    await expect(service.backupPush(env, 'logical')).resolves.toEqual(
      expect.objectContaining({ exitCode: 1 }),
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('deletes only an exact deterministic logical object and never a prefix', async () => {
    const proc = mockProcess();
    spawnMock.mockReturnValue(proc as any);
    const env = service.buildEnv({ storage_prefix: 's3://backups/mydb' }, { host: 'db', port: 5432, database_name: 'mydb' }, 'secret');

    for (const unsafe of ['logical', 'logical/', 'logical/*', `logical/${runId}`, `logical/${runId}.dump/child`, '../logical']) {
      await expect(service.deleteLogicalObject(env, unsafe)).resolves.toEqual(
        expect.objectContaining({ exitCode: 1 }),
      );
    }
    expect(spawnMock).not.toHaveBeenCalled();

    const deletion = service.deleteLogicalObject(env, objectName);
    await flush();
    proc.emit('close', 0);
    await expect(deletion).resolves.toEqual(expect.objectContaining({ exitCode: 0 }));
    expect(spawnMock).toHaveBeenCalledWith('wal-g', ['st', 'rm', '--glob', objectName], expect.anything());
  });

  describe('probeLogicalObject', () => {
    const env = { WALG_S3_PREFIX: 's3://backups/mydb' } as any;
    const leaf = `${runId}.dump`;
    const header = 'type size last modified                           name\n';

    async function probe(listing: string, exitCode = 0, name = objectName) {
      const proc = mockProcess();
      spawnMock.mockReturnValue(proc as any);
      const pending = service.probeLogicalObject(env, name);
      await flush();
      proc.stdout.write(listing);
      await flush();
      proc.emit('close', exitCode);
      return pending;
    }

    it('lists only the object folder and never downloads the dump', async () => {
      await probe(`${header}obj  4096 2026-08-31 05:52:11 +0000 UTC ${leaf}\n`);

      expect(spawnMock).toHaveBeenCalledTimes(1);
      expect(spawnMock).toHaveBeenCalledWith('wal-g', ['st', 'ls', 'logical'], expect.anything());
      expect(spawnMock).not.toHaveBeenCalledWith('wal-g', expect.arrayContaining(['cat']), expect.anything());
      expect(spawnMock).not.toHaveBeenCalledWith('wal-g', expect.arrayContaining(['-r']), expect.anything());
      expect(spawnMock).not.toHaveBeenCalledWith('wal-g', expect.arrayContaining(['-g']), expect.anything());
    });

    it('proves presence only for the exact key with a positive size', async () => {
      await expect(probe(`${header}obj  4096 2026-08-31 05:52:11 +0000 UTC ${leaf}\n`)).resolves.toEqual(
        expect.objectContaining({ status: 'present', size: 4096 }),
      );
    });

    it('reports absent when the folder holds other objects but not this key', async () => {
      const listing = `${header}`
        + 'dir  0    0001-01-01 00:00:00 +0000 UTC           /sub/\n'
        + 'obj  4096 2026-08-31 05:52:11 +0000 UTC 00000000-0000-4000-8000-0000000000ff.dump\n';

      await expect(probe(listing)).resolves.toEqual(expect.objectContaining({ status: 'absent', size: null }));
    });

    it('reports absent for an empty listing rather than assuming presence', async () => {
      await expect(probe(header)).resolves.toEqual(expect.objectContaining({ status: 'absent' }));
    });

    it('never accepts a prefix match, a folder entry, or a differently named neighbour', async () => {
      const listing = `${header}`
        + `dir  0    0001-01-01 00:00:00 +0000 UTC           /${leaf}/\n`
        + `obj  4096 2026-08-31 05:52:11 +0000 UTC prefixed-${leaf}\n`
        + `obj  4096 2026-08-31 05:52:11 +0000 UTC ${leaf}.partial\n`;

      await expect(probe(listing)).resolves.toEqual(expect.objectContaining({ status: 'absent' }));
    });

    it('treats a failed listing as unknown so the caller defers instead of deleting', async () => {
      await expect(probe('ERROR: storage unreachable\n', 1)).resolves.toEqual(
        expect.objectContaining({ status: 'unknown', size: null }),
      );
    });

    it('treats a zero-byte or unparseable size as unknown', async () => {
      await expect(probe(`${header}obj  0 2026-08-31 05:52:11 +0000 UTC ${leaf}\n`)).resolves.toEqual(
        expect.objectContaining({ status: 'unknown' }),
      );
      await expect(probe(`${header}obj  ? 2026-08-31 05:52:11 +0000 UTC ${leaf}\n`)).resolves.toEqual(
        expect.objectContaining({ status: 'unknown' }),
      );
    });

    it('treats an ambiguous duplicate listing as unknown', async () => {
      const listing = `${header}`
        + `obj  4096 2026-08-31 05:52:11 +0000 UTC ${leaf}\n`
        + `obj  8192 2026-08-31 05:53:11 +0000 UTC ${leaf}\n`;

      await expect(probe(listing)).resolves.toEqual(expect.objectContaining({ status: 'unknown' }));
    });

    it('refuses to probe a non-deterministic object without spawning wal-g', async () => {
      for (const unsafe of ['logical', 'logical/', 'logical/*', `logical/${runId}`, '../logical']) {
        await expect(service.probeLogicalObject(env, unsafe)).resolves.toEqual(
          expect.objectContaining({ status: 'unknown' }),
        );
      }
      expect(spawnMock).not.toHaveBeenCalled();
    });
  });
});
