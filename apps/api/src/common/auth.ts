import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from '@prisma/client';
import type { Request } from 'express';

export type AuthPrincipal = {
  sub: string;
  kind: 'admin' | 'citizen';
  role?: AdminRole;
  username?: string;
};
export type AuthenticatedRequest = Request & { user: AuthPrincipal };
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: AdminRole[]) => SetMetadata('roles', roles);

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer '))
      throw new UnauthorizedException('กรุณาเข้าสู่ระบบ');
    try {
      request.user = await this.jwt.verifyAsync<AuthPrincipal>(
        header.slice(7),
        {
          secret: process.env.JWT_ACCESS_SECRET,
        },
      );
    } catch {
      throw new UnauthorizedException('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    const roles = this.reflector.getAllAndOverride<AdminRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      roles?.length &&
      (!request.user.role || !roles.includes(request.user.role))
    ) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ดำเนินการ');
    }
    return true;
  }
}
