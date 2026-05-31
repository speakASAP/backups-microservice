import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ROLES_KEY, PUBLIC_KEY } from './roles.decorator';

@Injectable()
export class JwtRolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (isPublic) return true;

    const rolesMetadata = this.reflector.getAllAndOverride<{ roles: string[] }>(ROLES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    const requiredRoles = rolesMetadata?.roles?.length
      ? rolesMetadata.roles
      : ['global:superadmin', 'internal:backups-microservice:admin'];

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('Missing Authorization header');

    const token = authHeader.slice(7);
    const serviceToken = process.env.SERVICE_TOKEN;
    if (serviceToken && token === serviceToken) {
      (request as any).user = { sub: 'service:backups-microservice', roles: ['global:superadmin'] };
      return true;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; email?: string; roles?: string[] }>(token, {
        secret: process.env.JWT_SECRET,
      });
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
