import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    const origin = request.headers.origin;
    const expectedOrigin = this.config.getOrThrow<string>('APP_ORIGIN');
    if (origin && origin !== expectedOrigin) throw new ForbiddenException('Ungültige Request-Herkunft');
    const cookie = request.cookies?.csrf_token as string | undefined;
    const header = request.header('x-csrf-token');
    if (!cookie || !header) throw new ForbiddenException('CSRF-Token fehlt');
    const left = Buffer.from(cookie);
    const right = Buffer.from(header);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new ForbiddenException('CSRF-Token ungültig');
    return true;
  }
}
