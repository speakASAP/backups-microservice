import { Controller, Get, Post, Param, Body, Request } from "@nestjs/common";
import { RestoreService } from "./restore.service";
import { CreateRestoreDto } from "./dto/create-restore.dto";

@Controller("restore")
export class RestoreController {
  constructor(private readonly service: RestoreService) {}

  @Get() findAll() { return this.service.findAll().then((requests) => requests.map((request) => this.service.toPublicRequest(request))); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id).then((request) => this.service.toPublicRequest(request)); }

  @Post()
  create(@Body() dto: CreateRestoreDto, @Request() req: any) {
    const requestedBy = req.user?.email || req.user?.sub || "unknown";
    return this.service.create(dto, requestedBy).then((request) => this.service.toPublicRequest(request));
  }
}
