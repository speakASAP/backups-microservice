import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestoreRequest, RestoreStatus } from './entities/restore-request.entity';
import { CreateRestoreDto } from './dto/create-restore.dto';
import { BackupService } from '../backup/backup.service';
import { TargetsService } from '../targets/targets.service';
import { WalgWrapperService } from '../backup/walg-wrapper.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoggerService } from '../../shared/logger/logger.service';

@Injectable()
export class RestoreService {
  constructor(
    @InjectRepository(RestoreRequest) private repo: Repository<RestoreRequest>,
    private backupService: BackupService,
    private targetsService: TargetsService,
    private walg: WalgWrapperService,
    private notifications: NotificationsService,
    private logger: LoggerService,
  ) {}

  findAll(): Promise<RestoreRequest[]> {
    return this.repo.find({ order: { created_at: 'DESC' }, relations: ['backup_run', 'target'] });
  }

  async findOne(id: string): Promise<RestoreRequest> {
    const req = await this.repo.findOne({ where: { id }, relations: ['backup_run', 'target'] });
    if (!req) throw new Error(`RestoreRequest ${id} not found`);
    return req;
  }

  async create(dto: CreateRestoreDto, requestedBy: string): Promise<RestoreRequest> {
    const request = await this.repo.save(
      this.repo.create({
        backup_run_id: dto.backup_run_id,
        target_id: dto.target_id,
        status: RestoreStatus.PENDING,
        requested_by: requestedBy,
      }),
    );

    this.executeRestore(request.id).catch((err) =>
      this.logger.error(`Restore execution error: ${err}`, err.stack, 'RestoreService'),
    );

    return request;
  }

  private async executeRestore(requestId: string): Promise<void> {
    const request = await this.findOne(requestId);
    const backupRun = await this.backupService.findOne(request.backup_run_id);
    const target = await this.targetsService.findOne(request.target_id);

    request.status = RestoreStatus.RUNNING;
    request.started_at = new Date();
    await this.repo.save(request);

    const env = this.walg.buildEnv(
      { storage_prefix: backupRun.storage_path || undefined },
      target,
      process.env.DB_PASSWORD || '',
    );

    let output = '';
    const result = await this.walg.run(
      ['pgbackup-fetch', '/tmp/restore', 'LATEST'],
      env,
      (chunk) => { output += chunk; },
    );

    request.walg_output = output;
    request.completed_at = new Date();

    if (result.exitCode === 0) {
      request.status = RestoreStatus.COMPLETED;
      await this.repo.save(request);
      await this.notifications.send('restore.completed', `Restore completed for target: ${target.name}`, {
        request_id: request.id, backup_run_id: backupRun.id,
      });
    } else {
      request.status = RestoreStatus.FAILED;
      request.error_message = output.slice(-500);
      await this.repo.save(request);
      await this.notifications.send('restore.failed', `Restore FAILED for target: ${target.name}`, {
        request_id: request.id, error: request.error_message,
      });
      this.logger.error(`Restore failed request=${request.id}`, output, 'RestoreService');
    }
  }
}
