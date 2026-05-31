import { Module } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { WalgModule } from '../backup/walg.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoggerModule } from '../../shared/logger/logger.module';

@Module({
  imports: [WalgModule, NotificationsModule, LoggerModule],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
