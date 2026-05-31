import { IsString, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class UpdateJobDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() schedule_cron?: string;
  @IsOptional() @IsInt() @Min(1) retention_full_count?: number;
  @IsOptional() @IsString() storage_prefix?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
