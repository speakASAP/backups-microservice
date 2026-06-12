import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BackupJob } from "./entities/backup-job.entity";
import { JobsService } from "./jobs.service";
import { JobsController } from "./jobs.controller";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [TypeOrmModule.forFeature([BackupJob]), AuditModule],
  providers: [JobsService],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
