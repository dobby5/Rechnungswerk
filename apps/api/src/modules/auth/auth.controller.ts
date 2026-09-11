import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { AuthService, SessionTokens } from './auth.service';
import { LoginDto } from './auth.dto';

type RequestWithMeta = Request & { requestId?: string; user?: AuthUser };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  @Public()
  @Get('csrf')
  csrf(@Req() request: Request, @Res({ passthrough: true }) response: Response): { csrfToken: string } {
    const csrfToken = (request.cookies?.csrf_token as string | undefined) ?? randomBytes(32).toString('base64url');
    response.cookie('csrf_token', csrfToken, this.publicCookie());
    return { csrfToken };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: RequestWithMeta, @Res({ passthrough: true }) response: Response): Promise<{ user: AuthUser }> {
    const session = await this.auth.login(dto.email, dto.password, request.requestId, request.ip);
    this.writeSession(response, session);
    return { user: session.user };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<{ user: AuthUser }> {
    const session = await this.auth.refresh(request.cookies?.refresh_token as string | undefined);
    this.writeSession(response, session);
    return { user: session.user };
  }

  @Public()
  @Post('logout')
  async logout(@Req() request: RequestWithMeta, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request.cookies?.refresh_token as string | undefined, request.user?.id);
    response.clearCookie('access_token', this.httpOnlyCookie());
    response.clearCookie('refresh_token', this.httpOnlyCookie());
    response.clearCookie('csrf_token', this.publicCookie());
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): { user: AuthUser } { return { user }; }

  private writeSession(response: Response, session: SessionTokens): void {
    response.cookie('access_token', session.accessToken, { ...this.httpOnlyCookie(), maxAge: 15 * 60_000 });
    response.cookie('refresh_token', session.refreshToken, { ...this.httpOnlyCookie(), maxAge: this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 7) * 86_400_000 });
  }

  private httpOnlyCookie() {
    return { httpOnly: true, secure: this.config.get<boolean>('COOKIE_SECURE', false), sameSite: 'lax' as const, path: '/' };
  }

  private publicCookie() {
    return { httpOnly: false, secure: this.config.get<boolean>('COOKIE_SECURE', false), sameSite: 'lax' as const, path: '/' };
  }
}
