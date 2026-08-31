import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateRestoreDto {
  @IsUUID() backup_run_id: string;
  @IsUUID() target_id: string;
  @IsUUID() approval_confirmed_backup_run_id: string;
  @IsUUID() approval_confirmed_target_id: string;
  @IsString() @MinLength(2) approval_actor: string;
  @IsString() @MinLength(12) approval_reason: string;
  @IsBoolean() production_restore_approved: boolean;
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9._:-]+$/, { message: 'idempotency_key may only contain letters, digits, dot, underscore, colon or hyphen.' })
  idempotency_key?: string;
}
