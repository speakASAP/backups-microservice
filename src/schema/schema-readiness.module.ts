import { Module } from '@nestjs/common';
import { SchemaReadinessService } from './schema-readiness.service';

@Module({
  providers: [SchemaReadinessService],
  exports: [SchemaReadinessService],
})
export class SchemaReadinessModule {}
