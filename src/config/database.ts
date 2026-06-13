const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function getDatabaseSchema(): string {
  return process.env.DB_SCHEMA?.trim() || 'backups';
}

export function quoteIdentifier(identifier: string): string {
  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Invalid database identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

export function qualifyTable(schema: string, table: string): string {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}
