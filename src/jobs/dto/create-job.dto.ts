import { IsString, IsInt, IsOptional, IsBoolean, IsUUID, Min, Max, IsEnum } from 'class-validator';
import { SchedulePolicyType } from '../schedule-policy';

export class CreateJobDto {
  @IsUUID() target_id: string;
  @IsString() name: string;
  @IsOptional() @IsString() schedule_cron?: string;
  @IsOptional() @IsEnum(SchedulePolicyType) schedule_policy?: SchedulePolicyType;
  @IsOptional() @IsInt() @Min(0) @Max(23) schedule_hour_utc?: number;
  @IsOptional() @IsInt() @Min(0) @Max(59) schedule_minute_utc?: number;
  @IsOptional() @IsInt() @Min(0) @Max(6) schedule_day_of_week?: number;
  @IsOptional() @IsInt() @Min(1) retention_full_count?: number;
  @IsOptional() @IsString() retention_approval_actor?: string;
  @IsOptional() @IsString() retention_approval_reason?: string;
  @IsOptional() @IsString() storage_prefix?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
