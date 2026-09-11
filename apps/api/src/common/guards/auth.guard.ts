import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../types/auth-user';
import { User } from '../../database/entities/entities';

interface AccessPayload { sub: string; type: 'access' }
type AuthenticatedRequest = Request & { user?: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.access_token as string | undefined;
    if (!token) throw new UnauthorizedException('Anmeldung erforderlich');
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token);
      if (payload.type !== 'access') throw new Error('Invalid token type');
      const user = await this.users.findOne({
        where: { id: payload.sub, isActive: true },
        relations: { roles: { role: { permissions: { permission: true } } } },
      });
      if (!user) throw new Error('User unavailable');
      request.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles.map((entry) => entry.role.name),
        permissions: [...new Set(user.roles.flatMap((entry) => entry.role.permissions.map((grant) => grant.permission.key)))],
      };
      return true;
    } catch {
      throw new UnauthorizedException('Sitzung abgelaufen');
    }
  }
}
