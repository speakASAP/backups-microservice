import { IsUUID } from 'class-validator';

export class TriggerBackupDto {
  @IsUUID() job_id: string;
}
