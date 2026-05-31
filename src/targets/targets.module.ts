import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupTarget } from './entities/backup-target.entity';
import { TargetsService } from './targets.service';
import { TargetsController } from './targets.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BackupTarget])],
  providers: [TargetsService],
  controllers: [TargetsController],
  exports: [TargetsService],
})
export class TargetsModule {}
