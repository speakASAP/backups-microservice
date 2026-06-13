import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditService } from './audit.service';
import { LoggerModule } from '../../shared/logger/logger.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent]), LoggerModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
