/**
 * Backups role vocabulary.
 *
 * Every route must carry one of these constants or `@Public()`. Nothing may rely
 * on a guard default: an undecorated route previously inherited
 * [global:superadmin, internal:backups-microservice:admin], so a read-only caller
 * could also delete backup jobs, targets and destinations.
 *
 * Three tiers, narrowest first:
 *   READ   - list and inspect jobs, targets, destinations, backups, restores.
 *   WRITE  - create and update them, and trigger a backup or restore.
 *   ADMIN  - delete them, and read infrastructure discovery.
 */

export const BACKUPS_READ_ROLES = [
  'global:superadmin',
  'internal:backups-microservice:admin',
  'internal:backups-microservice:operator',
  'internal:backups-microservice:readonly',
] as const;

export const BACKUPS_WRITE_ROLES = [
  'global:superadmin',
  'internal:backups-microservice:admin',
  'internal:backups-microservice:operator',
] as const;

export const BACKUPS_ADMIN_ROLES = [
  'global:superadmin',
  'internal:backups-microservice:admin',
] as const;
