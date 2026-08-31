import { IsString, IsInt, IsOptional, IsBoolean, Min, Max, IsEnum, ValidateIf } from 'class-validator';
import { RestoreClass, SourceCategory, TargetCriticality } from '../entities/backup-target.entity';
import { IsSafeDatabaseName } from '../../common/database-name';

export class UpdateTargetDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @ValidateIf((dto: UpdateTargetDto) => dto.database_name !== undefined)
  @IsString()
  @IsSafeDatabaseName()
  database_name?: string;
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
