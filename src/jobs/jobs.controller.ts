import { Controller, Get, Post, Patch, Delete, Param, Body, Request } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';

@Controller('jobs')
export class JobsController {
  constructor(private readonly service: JobsService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateJobDto, @Request() req: any) { return this.service.create(dto, req.user?.sub || req.user?.email); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateJobDto, @Request() req: any) { return this.service.update(id, dto, req.user?.sub || req.user?.email); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
