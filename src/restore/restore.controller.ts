import { Controller, Get, Post, Param, Body, Request } from '@nestjs/common';
import { RestoreService } from './restore.service';
import { CreateRestoreDto } from './dto/create-restore.dto';

@Controller('restore')
export class RestoreController {
  constructor(private readonly service: RestoreService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() dto: CreateRestoreDto, @Request() req: any) {
    const requestedBy = req.user?.sub || 'unknown';
    return this.service.create(dto, requestedBy);
  }
}
