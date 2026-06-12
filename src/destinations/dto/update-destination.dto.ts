import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DestinationType } from '../entities/backup-destination.entity';

export class UpdateDestinationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(['s3', 'local', 'filesystem']) type?: DestinationType;
  @IsOptional() @IsString() uri?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(999) priority?: number;
}
