import {
  Injectable, CanActivate, ExecutionContext, Logger,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ROLES_KEY, PUBLIC_KEY } from './roles.decorator';
import { verifyAuthToken } from './jwt-verifier';

const ADMIN_COOKIE = 'backups_admin_token';

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const cookie = cookieHeader.split(';').find((part) => part.trim().startsWith(`${name}=`));
  if (!cookie) return undefined;
  return decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1).trim());
}

@Injectable()
export class JwtRolesGuard implements CanActivate {
  private readonly logger = new Logger(JwtRolesGuard.name);

  constructor(private reflector: Reflector, private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (isPublic) return true;

    const rolesMetadata = this.reflector.getAllAndOverride<{ roles: string[] }>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    // Deny by default. An undecorated route previously inherited
    // [global:superadmin, internal:backups-microservice:admin], granting delete
    // rights to any caller that only needed to read.
    if (!rolesMetadata?.roles?.length) {
      const handler = context.getHandler()?.name ?? 'unknown';
      const controller = context.getClass()?.name ?? 'unknown';
      this.logger.error(
        `Route ${controller}.${handler} has no @Roles decorator; denying request. ` +
          'Decorate it with a constant from src/auth/roles.constants.ts.',
      );
      throw new ForbiddenException('Route is missing an authorization policy');
    }

    const requiredRoles = rolesMetadata.roles;

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    const cookieToken = readCookie(request.headers.cookie, ADMIN_COOKIE);
    if (!authHeader?.startsWith('Bearer ') && !cookieToken) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;
    // Legacy shared static token. It is a single string with no principal behind
    // it, so it cannot be revoked through Auth; it is scoped to the operator tier
    // rather than global:superadmin, and still has to satisfy the route policy.
    const serviceToken = process.env.SERVICE_TOKEN;
    if (serviceToken && token === serviceToken) {
      const staticRoles = ['internal:backups-microservice:operator'];
      if (!requiredRoles.some((r) => staticRoles.includes(r))) {
        throw new ForbiddenException('Insufficient permissions');
      }
      this.logger.warn(
        'Request authenticated with the legacy static backups SERVICE_TOKEN; ' +
          'this credential is shared and unrevocable, and is limited to the operator tier.',
      );
      (request as any).user = { sub: 'service:backups-microservice', roles: staticRoles };
      return true;
    }

    try {
      // TASK-KEY-F3: accepts RS256 (auth's published key) and HS256 (the shared secret)
      // while the migration runs. See jwt-verifier.ts for the sequencing.
      const payload = await verifyAuthToken(token);
      const userRoles: string[] = Array.isArray(payload.roles) ? payload.roles : [];
      if (!requiredRoles.some((r) => userRoles.includes(r))) throw new ForbiddenException('Insufficient permissions');
      (request as any).user = { sub: payload.sub, email: payload.email, roles: userRoles };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) throw err;
      throw new UnauthorizedException('Invalid token');
    }
  }
}
