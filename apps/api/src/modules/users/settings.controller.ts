import { Body, Controller, Get, NotFoundException, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user';
import { CompanySettings } from '../../database/entities/entities';
import { AuditService } from '../audit/audit.service';
import { CompanySettingsDto } from './settings.dto';

@Controller('company-settings')
export class SettingsController {
  constructor(@InjectRepository(CompanySettings) private readonly settings: Repository<CompanySettings>, private readonly audit: AuditService) {}

  @Get()
  async get(@CurrentUser() user: AuthUser): Promise<CompanySettings> {
    const value = await this.settings.createQueryBuilder('settings').addSelect('settings.logoDataUrl').where('settings.userId = :userId', { userId: user.id }).getOne();
    if (!value) throw new NotFoundException('Firmeneinstellungen nicht gefunden');
    return value;
  }

  @Put()
  async update(@Body() dto: CompanySettingsDto, @CurrentUser() user: AuthUser): Promise<CompanySettings> {
    const current = await this.settings.findOne({ where: { userId: user.id } });
    if (!current) throw new NotFoundException('Firmeneinstellungen nicht gefunden');
    Object.assign(current, {
      ...dto,
      email: dto.email?.trim().toLowerCase() || null, phone: dto.phone?.trim() || null, taxId: dto.taxId?.trim() || null,
      vatId: dto.vatId?.trim() || null, bankName: dto.bankName?.trim() || null, iban: dto.iban?.replaceAll(' ', '').toUpperCase() || null,
      bic: dto.bic?.trim().toUpperCase() || null, logoDataUrl: dto.logoDataUrl ?? null, invoicePrefix: dto.invoicePrefix.toUpperCase(),
    });
    const saved = await this.settings.save(current);
    await this.audit.record({ userId: user.id, action: 'COMPANY_SETTINGS_UPDATED', entityType: 'CompanySettings', entityId: saved.id });
    return saved;
  }
}
