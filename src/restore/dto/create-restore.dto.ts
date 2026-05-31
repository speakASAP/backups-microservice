import { IsUUID } from 'class-validator';

export class CreateRestoreDto {
  @IsUUID() backup_run_id: string;
  @IsUUID() target_id: string;
}
