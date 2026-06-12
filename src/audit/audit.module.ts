import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';
import { LoggerModule } from '../../shared/logger/logger.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), LoggerModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
