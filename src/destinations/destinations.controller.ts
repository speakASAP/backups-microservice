import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';
import { DestinationsService } from './destinations.service';
import { Roles } from '../auth/roles.decorator';
import { BACKUPS_ADMIN_ROLES, BACKUPS_READ_ROLES, BACKUPS_WRITE_ROLES } from '../auth/roles.constants';

@Controller('destinations')
export class DestinationsController {
  constructor(private readonly service: DestinationsService) {}

  @Roles(...BACKUPS_READ_ROLES)

  @Get() findAll() { return this.service.findAll(); }
  @Roles(...BACKUPS_READ_ROLES)
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Roles(...BACKUPS_WRITE_ROLES)
  @Post() create(@Body() dto: CreateDestinationDto) { return this.service.create(dto); }
  @Roles(...BACKUPS_WRITE_ROLES)
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDestinationDto) { return this.service.update(id, dto); }
  @Roles(...BACKUPS_ADMIN_ROLES)
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
