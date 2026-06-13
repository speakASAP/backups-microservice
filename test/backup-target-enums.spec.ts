import { RestoreClass, SourceCategory, TargetCriticality, TargetType } from '../src/targets/entities/backup-target.entity';

describe('BackupTarget coverage enums', () => {
  it('keeps PostgreSQL as the executable target type', () => {
    expect(TargetType.POSTGRES).toBe('postgres');
    expect(SourceCategory.POSTGRES_DATABASE).toBe('postgres_database');
    expect(RestoreClass.LOGICAL_POSTGRES).toBe('logical_postgres');
  });

  it('defines contract-only ecosystem source categories', () => {
    expect(SourceCategory.MINIO_BUCKET).toBe('minio_bucket');
    expect(SourceCategory.KUBERNETES_RESOURCE).toBe('kubernetes_resource');
    expect(SourceCategory.SECRET_REFERENCE).toBe('secret_reference');
    expect(SourceCategory.PVC).toBe('pvc');
  });

  it('defines restore classes without secret material', () => {
    expect(RestoreClass.OBJECT_RESTORE).toBe('object_restore');
    expect(RestoreClass.MANIFEST_REAPPLY).toBe('manifest_reapply');
    expect(RestoreClass.SECRET_REHYDRATION).toBe('secret_rehydration');
    expect(RestoreClass.VOLUME_RESTORE).toBe('volume_restore');
    expect(RestoreClass.MANUAL).toBe('manual');
    expect(TargetCriticality.CRITICAL).toBe('critical');
  });
});
