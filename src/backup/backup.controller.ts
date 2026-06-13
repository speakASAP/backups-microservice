import { Controller, Get, Post, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { BackupService } from './backup.service';
import { TriggerBackupDto } from './dto/trigger-backup.dto';

interface DeleteBackupRunDto {
  reason?: string;
}

@Controller('backups')
export class BackupController {
  constructor(private readonly service: BackupService) {}

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

  @Get(':id') findOne(@Param('id') id: string) {
    return this.service.findOne(id).then((run) => this.service.toPublicRun(run));
  }

  @Post('trigger')
  trigger(@Body() dto: TriggerBackupDto) {
    return this.service.triggerManual(dto.job_id).then((run) => this.service.toPublicRun(run));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Body() dto: DeleteBackupRunDto, @Request() req: any) {
    return this.service.remove(id, req.user?.sub || req.user?.email, dto?.reason);
  }
}
