import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { getDatabaseSchema } from './config/database';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'db-server-postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'dbadmin',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'backups',
  schema: getDatabaseSchema(),
  entities: [__dirname + '/**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
