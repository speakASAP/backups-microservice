/**
 * Database-enforced restore controls. The names are shared by the migration that
 * creates the indexes and by the service that translates their violations.
 */
export const RESTORE_IDEMPOTENCY_INDEX = 'uq_restore_requests_idempotency_key';
export const RESTORE_ACTIVE_TARGET_INDEX = 'uq_restore_requests_active_target';
