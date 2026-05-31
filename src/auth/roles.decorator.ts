import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'public';
export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, { roles });
