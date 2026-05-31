import { IsString, IsInt, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class UpdateTargetDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() database_name?: string;
  @IsOptional() @IsString() vault_secret_ref?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
