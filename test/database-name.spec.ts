import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  assertSafeDatabaseName,
  databaseNameViolation,
  isSafeDatabaseName,
} from '../src/common/database-name';
import { CreateTargetDto } from '../src/targets/dto/create-target.dto';
import { UpdateTargetDto } from '../src/targets/dto/update-target.dto';

const ACCEPTED = [
  'backups',
  'speakasap_main_db',
  'wisdom-quotes',
  'wisdom_quotes',
  'k3s-cluster-state',
  'external-secrets-vault-backend',
  'agentic_platform',
];

const REJECTED: Array<[string, unknown]> = [
  ['connection URI', 'postgres://user:pass@host:5432/db'],
  ['bare scheme separator', 'db://x'],
  ['host:port form', 'host:5432'],
  ['key=value pair', 'dbname=evil'],
  ['multiple key=value pairs', 'host=attacker port=5432'],
  ['long option', '--dbname=evil'],
  ['short option', '-h'],
  ['inner space', 'restored db'],
  ['leading space', ' restored'],
  ['trailing space', 'restored '],
  ['tab', "restored\tdb"],
  ['newline', "restored\ndb"],
  ['null byte', "restored\u0000db"],
  ['delete control character', "restored\u007fdb"],
  ['path separator', 'schema/db'],
  ['windows path separator', 'schema\\db'],
  ['shell metacharacter', 'db;DROP DATABASE x'],
  ['empty string', ''],
  ['non-string', 42],
  ['null', null],
  ['undefined', undefined],
  ['over length', 'a'.repeat(64)],
];

function validateDatabaseName(dto: object): string[] {
  return validateSync(dto)
    .filter((error) => error.property === 'database_name')
    .flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('database_name strict validation', () => {
  it.each(ACCEPTED)('accepts the existing catalog name %p', (name) => {
    expect(databaseNameViolation(name)).toBeNull();
    expect(isSafeDatabaseName(name)).toBe(true);
    expect(assertSafeDatabaseName(name)).toBe(name);
  });

  it.each(REJECTED)('rejects %s', (_label, value) => {
    expect(isSafeDatabaseName(value)).toBe(false);
    expect(databaseNameViolation(value)).not.toBeNull();
    expect(() => assertSafeDatabaseName(value)).toThrow(BadRequestException);
  });

  it('rejects unsafe values at the create-target DTO boundary', () => {
    for (const [, value] of REJECTED) {
      const dto = plainToInstance(CreateTargetDto, {
        name: 'target',
        host: 'db',
        port: 5432,
        database_name: value,
      });
      expect(validateDatabaseName(dto).length).toBeGreaterThan(0);
    }
  });

  it('rejects unsafe values at the update-target DTO boundary', () => {
    for (const [, value] of REJECTED) {
      if (value === undefined) continue;
      const dto = plainToInstance(UpdateTargetDto, { database_name: value });
      expect(validateDatabaseName(dto).length).toBeGreaterThan(0);
    }
  });

  it('accepts catalog names at both DTO boundaries', () => {
    for (const name of ACCEPTED) {
      const create = plainToInstance(CreateTargetDto, {
        name: 'target',
        host: 'db',
        port: 5432,
        database_name: name,
      });
      expect(validateDatabaseName(create)).toEqual([]);
      expect(validateDatabaseName(plainToInstance(UpdateTargetDto, { database_name: name }))).toEqual([]);
    }
  });
});
