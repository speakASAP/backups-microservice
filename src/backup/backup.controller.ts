import { Controller, Get, Post, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { BackupService } from './backup.service';
import { TriggerBackupDto } from './dto/trigger-backup.dto';
import { DeleteBackupRunDto } from './dto/delete-backup-run.dto';
import { Roles } from '../auth/roles.decorator';
import { BACKUPS_ADMIN_ROLES, BACKUPS_READ_ROLES, BACKUPS_WRITE_ROLES } from '../auth/roles.constants';

function actorFromRequest(req: any): string {
  return req.user?.email || req.user?.sub || 'unknown';
}

@Controller('backups')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Roles(...BACKUPS_READ_ROLES)

  @Get()
  findAll(
    @Query('job_id') jobId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service
      .findAll(jobId, status, Number(limit) || 20, Number(offset) || 0)
      .then((runs) => runs.map((run) => this.service.toPublicRun(run)));
  }

  @Roles(...BACKUPS_READ_ROLES)

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id).then((run) => this.service.toPublicRun(run));
  }

  @Roles(...BACKUPS_WRITE_ROLES)

  @Post('trigger')
  trigger(@Body() dto: TriggerBackupDto, @Request() req: any) {
    return this.service.triggerManual(dto.job_id, actorFromRequest(req)).then((run) => this.service.toPublicRun(run));
  }

  @Roles(...BACKUPS_ADMIN_ROLES)

  @Delete(':id')
  remove(@Param('id') id: string, @Body() dto: DeleteBackupRunDto, @Request() req: any) {
    return this.service.remove(id, actorFromRequest(req), dto);
  }
}
