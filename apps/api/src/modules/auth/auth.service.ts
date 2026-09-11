import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../../common/types/auth-user';
import { RefreshToken, User } from '../../database/entities/entities';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from './password.service';

export interface SessionTokens { accessToken: string; refreshToken: string; user: AuthUser }

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
  ) {}

  async login(email: string, password: string, requestId?: string, ip?: string): Promise<SessionTokens> {
    const user = await this.users.createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.roles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .leftJoinAndSelect('role.permissions', 'rolePermission')
      .leftJoinAndSelect('rolePermission.permission', 'permission')
      .where('LOWER(user.email) = LOWER(:email)', { email: email.trim() })
      .andWhere('user.isActive = true')
      .getOne();
    const valid = user ? await this.passwords.verify(user.passwordHash, password) : false;
    if (!user || !valid) throw new UnauthorizedException('E-Mail-Adresse oder Passwort ist falsch');
    const session = await this.issueSession(user);
    await this.audit.record({ userId: user.id, action: 'AUTH_LOGIN', entityType: 'User', entityId: user.id, requestId, ip });
    return session;
  }

  async refresh(rawToken: string | undefined): Promise<SessionTokens> {
    if (!rawToken) throw new UnauthorizedException('Refresh-Token fehlt');
    const [id, secret, extra] = rawToken.split('.');
    if (!id || !secret || extra) throw new UnauthorizedException('Refresh-Token ungültig');
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RefreshToken);
      const stored = await repo.findOne({ where: { id }, relations: { user: { roles: { role: { permissions: { permission: true } } } } } });
      if (!stored || stored.revokedAt || stored.expiresAt <= new Date() || !stored.user.isActive || !this.hashMatches(secret, stored.tokenHash)) {
        throw new UnauthorizedException('Refresh-Token ungültig oder abgelaufen');
      }
      stored.revokedAt = new Date();
      const next = await this.issueSession(stored.user, manager);
      stored.replacedById = next.refreshToken.split('.')[0] ?? null;
      await repo.save(stored);
      return next;
    });
  }

  async logout(rawToken: string | undefined, userId?: string): Promise<void> {
    const id = rawToken?.split('.')[0];
    if (id) await this.refreshTokens.update({ id }, { revokedAt: new Date() });
    if (userId) await this.audit.record({ userId, action: 'AUTH_LOGOUT', entityType: 'User', entityId: userId });
  }

  private async issueSession(user: User, manager = this.dataSource.manager): Promise<SessionTokens> {
    const accessToken = await this.jwt.signAsync({ sub: user.id, type: 'access' }, { expiresIn: this.config.get<string>('ACCESS_TOKEN_TTL', '15m') as never });
    const secret = randomBytes(32).toString('base64url');
    const days = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 7);
    const token = await manager.getRepository(RefreshToken).save({
      userId: user.id,
      tokenHash: createHash('sha256').update(secret).digest('hex'),
      expiresAt: new Date(Date.now() + days * 86_400_000),
      revokedAt: null,
      replacedById: null,
    });
    return { accessToken, refreshToken: `${token.id}.${secret}`, user: this.toAuthUser(user) };
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map((entry) => entry.role.name),
      permissions: [...new Set(user.roles.flatMap((entry) => entry.role.permissions.map((grant) => grant.permission.key)))],
    };
  }

  private hashMatches(secret: string, hash: string): boolean {
    const actual = Buffer.from(createHash('sha256').update(secret).digest('hex'));
    const expected = Buffer.from(hash);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
