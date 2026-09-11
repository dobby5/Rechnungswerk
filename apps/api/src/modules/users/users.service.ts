import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CompanySettings, Role, User, UserRole } from '../../database/entities/entities';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { PasswordService } from '../auth/password.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
  ) {}

  async list(): Promise<User[]> {
    return this.users.find({ relations: { roles: { role: true } }, order: { name: 'ASC' } });
  }

  async create(dto: CreateUserDto, actorId: string): Promise<User> {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.exist({ where: { email } })) throw new ConflictException('E-Mail-Adresse ist bereits vergeben');
    const roles = await this.roles.findBy({ name: In(dto.roleNames) });
    if (roles.length !== new Set(dto.roleNames).size) throw new BadRequestException('Mindestens eine Rolle ist unbekannt');
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).save({
        email,
        name: dto.name.trim(),
        passwordHash: await this.passwords.hash(dto.password),
        isActive: true,
      });
      await manager.getRepository(UserRole).save(roles.map((role) => ({ userId: user.id, roleId: role.id })));
      await manager.getRepository(CompanySettings).save({
        userId: user.id, companyName: dto.name.trim(), street: 'Bitte konfigurieren', postalCode: '00000', city: 'Bitte konfigurieren',
        country: 'DE', email, invoicePrefix: 'RE', defaultCurrency: 'EUR', paymentTermsDays: 14,
      });
      await this.audit.record({ userId: actorId, action: 'USER_CREATED', entityType: 'User', entityId: user.id, metadata: { email, roles: dto.roleNames } }, manager);
      return (await manager.getRepository(User).findOne({ where: { id: user.id }, relations: { roles: { role: true } } }))!;
    });
  }

  async update(id: string, dto: UpdateUserDto, actorId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id }, relations: { roles: { role: true } } });
    if (!user) throw new NotFoundException('Benutzer nicht gefunden');
    if (id === actorId && dto.isActive === false) throw new BadRequestException('Das eigene Konto kann nicht deaktiviert werden');
    return this.dataSource.transaction(async (manager) => {
      if (dto.name !== undefined) user.name = dto.name.trim();
      if (dto.isActive !== undefined) user.isActive = dto.isActive;
      await manager.getRepository(User).save(user);
      if (dto.roleNames) {
        const roles = await manager.getRepository(Role).findBy({ name: In(dto.roleNames) });
        if (roles.length !== new Set(dto.roleNames).size) throw new BadRequestException('Mindestens eine Rolle ist unbekannt');
        await manager.getRepository(UserRole).delete({ userId: id });
        await manager.getRepository(UserRole).save(roles.map((role) => ({ userId: id, roleId: role.id })));
      }
      await this.audit.record({ userId: actorId, action: 'USER_UPDATED', entityType: 'User', entityId: id, metadata: { fields: Object.keys(dto) } }, manager);
      return (await manager.getRepository(User).findOne({ where: { id }, relations: { roles: { role: true } } }))!;
    });
  }
}
