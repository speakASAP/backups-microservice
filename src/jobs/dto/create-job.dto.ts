import { IsString, IsInt, IsOptional, IsBoolean, IsUUID, Min } from 'class-validator';

export class CreateJobDto {
  @IsUUID() target_id: string;
  @IsString() name: string;
  @IsString() schedule_cron: string;
  @IsOptional() @IsInt() @Min(1) retention_full_count?: number;
  @IsOptional() @IsString() retention_approval_actor?: string;
  @IsOptional() @IsString() retention_approval_reason?: string;
  @IsOptional() @IsString() storage_prefix?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
