import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './health/health.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'db-server-postgres',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USER || 'dbadmin',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'backups',
        schema: 'backups',
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    ScheduleModule.forRoot(),
    HealthModule,
  ],
})
export class AppModule {}
