import { Controller, Get } from '@nestjs/common';
import { DiscoveryService } from './discovery.service';
import { Roles } from '../auth/roles.decorator';
import { BACKUPS_ADMIN_ROLES } from '../auth/roles.constants';

@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly service: DiscoveryService) {}

  @Roles(...BACKUPS_ADMIN_ROLES)

  @Get('kubernetes') kubernetes() {
    return this.service.kubernetes();
  }
}
