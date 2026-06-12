import { IsString, IsInt, IsOptional, IsBoolean, Min, Max, IsEnum } from 'class-validator';
import { RestoreClass, SourceCategory, TargetCriticality } from '../entities/backup-target.entity';

export class UpdateTargetDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() database_name?: string;
  @IsOptional() @IsString() vault_secret_ref?: string;
  @IsOptional() @IsString() service_owner?: string;
  @IsOptional() @IsEnum(SourceCategory) source_category?: SourceCategory;
  @IsOptional() @IsEnum(TargetCriticality) criticality?: TargetCriticality;
  @IsOptional() @IsInt() @Min(1) rpo_minutes?: number;
  @IsOptional() @IsInt() @Min(1) rto_minutes?: number;
  @IsOptional() @IsEnum(RestoreClass) restore_class?: RestoreClass;
  @IsOptional() @IsString() kubernetes_namespace?: string;
  @IsOptional() @IsString() coverage_notes?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
