import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  const webPath = path.join(process.cwd(), 'web');
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path === '/admin' || req.path === '/admin/') return res.sendFile(path.join(webPath, 'admin', 'index.html'));
    if (req.path.startsWith('/backups') || req.path.startsWith('/jobs') || req.path.startsWith('/targets')
      || req.path.startsWith('/restore') || req.path.startsWith('/dashboard')
      || req.path.startsWith('/health') || req.path.startsWith('/info')) return next();
    express.static(webPath)(req, res, next);
  });

  app.enableCors({ origin: process.env.CORS_ORIGIN || '*', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: false, skipMissingProperties: true }));

  const port = parseInt(process.env.PORT || '3398', 10);
  await app.listen(port);
  logger.log(`backups-microservice running on port ${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});
