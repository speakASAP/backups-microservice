import { IsString, IsInt, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class CreateTargetDto {
  @IsString() name: string;
  @IsString() host: string;
  @IsInt() @Min(1) @Max(65535) port: number = 5432;
  @IsString() database_name: string;
  @IsOptional() @IsString() vault_secret_ref?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
}
