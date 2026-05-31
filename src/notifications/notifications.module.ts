import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationsService } from './notifications.service';
import { LoggerModule } from '../../shared/logger/logger.module';

@Module({
  imports: [HttpModule, LoggerModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
