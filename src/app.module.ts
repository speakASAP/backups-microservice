import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { LoggerModule } from '../shared/logger/logger.module';
import { HealthController } from './health/health.controller';
import { InfoController } from './info/info.controller';
import { TargetsModule } from './targets/targets.module';
import { JobsModule } from './jobs/jobs.module';
import { BackupModule } from './backup/backup.module';
import { RetentionModule } from './retention/retention.module';
import { RestoreModule } from './restore/restore.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JwtRolesGuard } from './auth/jwt-roles.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { DestinationsModule } from './destinations/destinations.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { AuditModule } from "./audit/audit.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'db-server-postgres',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'dbadmin',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'backups',
      autoLoadEntities: true,
      synchronize: false,
      logging: process.env.NODE_ENV === 'development',
    }),
    AuthModule,
    LoggerModule,
    TargetsModule,
    JobsModule,
    BackupModule,
    RetentionModule,
    RestoreModule,
    NotificationsModule,
    DestinationsModule,
    DiscoveryModule,
    DashboardModule,
    AuditModule,
  ],
  controllers: [HealthController, InfoController],
  providers: [{ provide: APP_GUARD, useClass: JwtRolesGuard }],
})
export class AppModule {}
