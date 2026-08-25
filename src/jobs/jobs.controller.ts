import { Controller, Get, Post, Patch, Delete, Param, Body, Request } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { Roles } from '../auth/roles.decorator';
import { BACKUPS_ADMIN_ROLES, BACKUPS_READ_ROLES, BACKUPS_WRITE_ROLES } from '../auth/roles.constants';

function actorFromRequest(req: any): string {
  return req.user?.email || req.user?.sub || 'unknown';
}

@Controller('jobs')
export class JobsController {
  constructor(private readonly service: JobsService) {}

  @Roles(...BACKUPS_READ_ROLES)

  @Get() findAll() { return this.service.findAll(); }
  @Roles(...BACKUPS_READ_ROLES)
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Roles(...BACKUPS_WRITE_ROLES)
  @Post() create(@Body() dto: CreateJobDto, @Request() req: any) { return this.service.create(dto, actorFromRequest(req)); }
  @Roles(...BACKUPS_WRITE_ROLES)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateJobDto, @Request() req: any) { return this.service.update(id, dto, actorFromRequest(req)); }
  @Roles(...BACKUPS_ADMIN_ROLES)
  @Delete(':id') remove(@Param('id') id: string, @Request() req: any) { return this.service.remove(id, actorFromRequest(req)); }
}
