import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

const ADMIN_COOKIE = 'backups_admin_token';
const ADMIN_ROLES = ['global:superadmin', 'internal:backups-microservice:admin'];

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const index = part.indexOf('=');
    if (index === -1) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function adminCookieOptions(maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function isProtectedAdminPage(reqPath: string): boolean {
  return ['/admin', '/admin/', '/admin/index.html', '/admin/jobs.html', '/admin/restore.html'].includes(reqPath);
}

function isAuthorizedAdminToken(jwtService: JwtService, token?: string): boolean {
  if (!token) return false;
  const serviceToken = process.env.SERVICE_TOKEN;
  if (serviceToken && token === serviceToken) return true;

  try {
    const payload = jwtService.verify<{ roles?: string[] }>(token, { secret: process.env.JWT_SECRET });
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    return ADMIN_ROLES.some((role) => roles.includes(role));
  } catch {
    return false;
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  const jwtService = app.get(JwtService);

  const webPath = path.join(process.cwd(), 'web');
  app.use(express.json({ limit: '32kb' }));
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/admin/')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    if (req.path === '/admin/login') {
      return res.sendFile(path.join(webPath, 'admin', 'login.html'));
    }
    if (req.path === '/admin/session' || req.path === '/admin/logout') return next();
    if (isProtectedAdminPage(req.path)) {
      const token = parseCookies(req.headers.cookie)[ADMIN_COOKIE];
      if (!isAuthorizedAdminToken(jwtService, token)) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; ${adminCookieOptions(0)}`);
        return res.redirect(302, `/admin/login?returnTo=${encodeURIComponent(req.originalUrl || '/admin')}`);
      }
      res.setHeader('Cache-Control', 'no-store');
      if (req.path === '/admin' || req.path === '/admin/' || req.path === '/admin/index.html') {
        return res.sendFile(path.join(webPath, 'admin', 'index.html'));
      }
    }
    if (req.path.startsWith('/backups') || req.path.startsWith('/jobs') || req.path.startsWith('/targets')
      || req.path.startsWith('/restore') || req.path.startsWith('/dashboard')
      || req.path.startsWith('/health') || req.path.startsWith('/info')) return next();
    express.static(webPath)(req, res, next);
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.post('/admin/session', async (req: express.Request, res: express.Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    try {
      const authUrl = (process.env.AUTH_SERVICE_URL || 'http://auth-microservice.statex-apps.svc.cluster.local:3370').replace(/\/$/, '');
      const authResponse = await fetch(`${authUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await authResponse.json().catch(() => null);
      const accessToken = payload?.accessToken;
      if (!authResponse.ok || !isAuthorizedAdminToken(jwtService, accessToken)) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
      }

      res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=${encodeURIComponent(accessToken)}; ${adminCookieOptions(7 * 24 * 60 * 60)}`);
      return res.json({ success: true });
    } catch (error) {
      logger.error(`Admin login failed: ${(error as Error).message}`);
      return res.status(502).json({ message: 'Authentication service is unavailable' });
    }
  });

  expressApp.post('/admin/logout', (_req: express.Request, res: express.Response) => {
    res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; ${adminCookieOptions(0)}`);
    return res.json({ success: true });
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
