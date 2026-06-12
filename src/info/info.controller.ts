import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/roles.decorator';

@Controller('info')
export class InfoController {
  @Public()
  @Get()
  info() {
    return {
      service: 'backups-microservice',
      version: '1.0.0',
      status: 'operational',
      endpoints: {
        health: 'GET /health',
        backups: 'GET /backups',
        jobs: 'GET /jobs',
        targets: 'GET /targets',
        restore: 'GET /restore',
        dashboard: 'GET /dashboard/summary',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
