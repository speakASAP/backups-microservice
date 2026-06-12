import { Module } from '@nestjs/common';
import { WalgWrapperService } from './walg-wrapper.service';
import { LoggerModule } from '../../shared/logger/logger.module';

@Module({
  imports: [LoggerModule],
  providers: [WalgWrapperService],
  exports: [WalgWrapperService],
})
export class WalgModule {}
