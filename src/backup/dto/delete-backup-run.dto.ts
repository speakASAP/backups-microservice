import { IsOptional, IsString } from 'class-validator';

export class DeleteBackupRunDto {
  @IsOptional() @IsString() approval_actor?: string;
  @IsOptional() @IsString() approval_reason?: string;
}
