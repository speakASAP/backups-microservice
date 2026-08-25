import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { TargetsService } from './targets.service';
import { CreateTargetDto } from './dto/create-target.dto';
import { UpdateTargetDto } from './dto/update-target.dto';
import { Roles } from '../auth/roles.decorator';
import { BACKUPS_ADMIN_ROLES, BACKUPS_READ_ROLES, BACKUPS_WRITE_ROLES } from '../auth/roles.constants';

@Controller('targets')
export class TargetsController {
  constructor(private readonly service: TargetsService) {}

  @Roles(...BACKUPS_READ_ROLES)

  @Get() findAll() { return this.service.findAll(); }
  @Roles(...BACKUPS_READ_ROLES)
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Roles(...BACKUPS_WRITE_ROLES)
  @Post() create(@Body() dto: CreateTargetDto) { return this.service.create(dto); }
  @Roles(...BACKUPS_WRITE_ROLES)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateTargetDto) { return this.service.update(id, dto); }
  @Roles(...BACKUPS_ADMIN_ROLES)
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
