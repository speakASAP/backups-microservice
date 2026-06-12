import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRestoreDto {
  @IsUUID() backup_run_id: string;
  @IsUUID() target_id: string;
  @IsOptional() @IsIn(['production', 'staging', 'development', 'test', 'verification']) target_environment?: string;
  @IsOptional() @IsString() approval_actor?: string;
  @IsOptional() @IsString() approval_reason?: string;
  @IsOptional() @IsBoolean() approval_confirmed?: boolean;
}
