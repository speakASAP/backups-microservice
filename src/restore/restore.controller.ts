import { BadRequestException, Controller, Get, Post, Param, Body, Request } from '@nestjs/common';
import { RestoreService } from './restore.service';
import { CreateRestoreDto } from './dto/create-restore.dto';
import { Roles } from '../auth/roles.decorator';
import { BACKUPS_READ_ROLES, BACKUPS_WRITE_ROLES } from '../auth/roles.constants';

@Controller('restore')
export class RestoreController {
  constructor(private readonly service: RestoreService) {}

  @Roles(...BACKUPS_READ_ROLES)

  @Get() findAll() { return this.service.findAll().then((requests) => requests.map((request) => this.service.toPublicRequest(request))); }
  @Roles(...BACKUPS_READ_ROLES)
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id).then((request) => this.service.toPublicRequest(request)); }

  @Roles(...BACKUPS_WRITE_ROLES)

  @Post()
  create(@Body() dto: CreateRestoreDto, @Request() req: any) {
    const requestedBy = req.user?.sub || req.user?.email;
    if (!requestedBy) throw new BadRequestException('Authenticated actor evidence is required for restore requests.');
    return this.service.create(dto, requestedBy).then((request) => this.service.toPublicRequest(request));
  }
}
