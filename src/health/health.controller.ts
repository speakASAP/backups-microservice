import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'backups-microservice', timestamp: new Date().toISOString() };
  }
}
