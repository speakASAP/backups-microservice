import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/roles.decorator';
import { BACKUPS_READ_ROLES } from '../auth/roles.constants';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles(...BACKUPS_READ_ROLES)

  @Get('summary')
  summary(): Promise<Record<string, unknown>> {
    return this.dashboardService.summary();
  }
}
