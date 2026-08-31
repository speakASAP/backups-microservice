import { BadRequestException } from '@nestjs/common';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export const DATABASE_NAME_MAX_LENGTH = 63;

const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_$-]*$/;
const WHITESPACE_OR_CONTROL = /[\u0000-\u0020\u007f-\u009f]/;

export function databaseNameViolation(value: unknown): string | null {
  if (typeof value !== 'string') {
    return 'database name must be a plain string';
  }
  if (value.length === 0) {
    return 'database name is required';
  }
  if (value.length > DATABASE_NAME_MAX_LENGTH) {
    return `database name must not exceed ${DATABASE_NAME_MAX_LENGTH} characters`;
  }
  if (WHITESPACE_OR_CONTROL.test(value)) {
    return 'database name must not contain whitespace or control characters';
  }
  if (value.startsWith('-')) {
    return 'database name must not look like a command-line option';
  }
  if (value.includes('=')) {
    return 'database name must not contain connection key=value syntax';
  }
  if (value.includes(':') || value.includes('/') || value.includes('\\')) {
    return 'database name must not contain a connection URI or path separator';
  }
  if (!DATABASE_NAME_PATTERN.test(value)) {
    return 'database name may only contain letters, digits, underscore, dollar or hyphen';
  }
  return null;
}

export function isSafeDatabaseName(value: unknown): boolean {
  return databaseNameViolation(value) === null;
}

export function assertSafeDatabaseName(value: unknown, subject = 'Target'): string {
  const violation = databaseNameViolation(value);
  if (violation) {
    throw new BadRequestException(`${subject} database name rejected: ${violation}.`);
  }
  return value as string;
}

export function IsSafeDatabaseName(validationOptions?: ValidationOptions) {
  return function registerSafeDatabaseName(object: object, propertyName: string): void {
    registerDecorator({
      name: 'isSafeDatabaseName',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isSafeDatabaseName(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} rejected: ${databaseNameViolation(args.value) ?? 'invalid database name'}.`;
        },
      },
    });
  };
}
