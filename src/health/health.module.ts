import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SchemaReadinessModule } from '../schema/schema-readiness.module';

@Module({
  imports: [SchemaReadinessModule],
  controllers: [HealthController],
})
export class HealthModule {}
