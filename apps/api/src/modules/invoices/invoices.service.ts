import { InvoiceStatus, allowedStatusTransitions } from '@rechnungswerk/shared';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Brackets, DataSource, EntityManager, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { AuthUser } from '../../common/types/auth-user';
import {
  CompanySettings, Customer, Invoice, InvoiceItem, InvoiceStatusHistory, InvoiceVersion, JsonObject,
} from '../../database/entities/entities';
import { AuditService } from '../audit/audit.service';
import { ChangeStatusDto, InvoiceItemDto, RestoreVersionDto, SaveInvoiceDto } from './invoice.dto';
import { CalculationResult, MoneyService } from './money.service';
import { InvoicePolicyService } from './invoice-policy.service';

interface InvoiceListOptions {
  page?: number; pageSize?: number; search?: string; customerId?: string; status?: InvoiceStatus;
  dateFrom?: string; dateTo?: string; invoiceNumber?: string; userId?: string; sortBy?: string; sortOrder?: 'ASC' | 'DESC';
}

interface StoredSnapshot extends JsonObject {
  invoice: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(InvoiceVersion) private readonly versions: Repository<InvoiceVersion>,
    private readonly dataSource: DataSource,
    private readonly money: MoneyService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly policy: InvoicePolicyService,
  ) {}

  async list(user: AuthUser, options: InvoiceListOptions = {}) {
    const page = Math.max(options.page ?? 1, 1);
    const take = Math.min(Math.max(options.pageSize ?? 25, 1), 100);
    const query = this.invoices.createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.items', 'item')
      .leftJoinAndSelect('invoice.owner', 'owner')
      .where('invoice.deletedAt IS NULL');
    if (!this.isAdmin(user)) query.andWhere('invoice.ownerId = :ownerId', { ownerId: user.id });
    else if (options.userId) query.andWhere('invoice.ownerId = :filterOwnerId', { filterOwnerId: options.userId });
    if (options.search?.trim()) query.andWhere('invoice.searchText ILIKE :search', { search: `%${options.search.trim()}%` });
    if (options.customerId) query.andWhere('invoice.customerId = :customerId', { customerId: options.customerId });
    if (options.status) query.andWhere('invoice.status = :status', { status: options.status });
    if (options.dateFrom) query.andWhere('invoice.invoiceDate >= :dateFrom', { dateFrom: options.dateFrom });
    if (options.dateTo) query.andWhere('invoice.invoiceDate <= :dateTo', { dateTo: options.dateTo });
    if (options.invoiceNumber?.trim()) query.andWhere('invoice.invoiceNumber ILIKE :invoiceNumber', { invoiceNumber: `%${options.invoiceNumber.trim()}%` });
    const sortColumns: Record<string, string> = {
      invoiceDate: 'invoice.invoiceDate', dueDate: 'invoice.dueDate', invoiceNumber: 'invoice.invoiceNumber',
      status: 'invoice.status', grossMinor: 'invoice.grossMinor', updatedAt: 'invoice.updatedAt',
    };
    const sort = sortColumns[options.sortBy ?? 'updatedAt'] ?? sortColumns.updatedAt!;
    query.orderBy(sort, options.sortOrder === 'ASC' ? 'ASC' : 'DESC').addOrderBy('item.position', 'ASC').skip((page - 1) * take).take(take);
    const [data, total] = await query.getManyAndCount();
    return { data, meta: { page, pageSize: take, total, totalPages: Math.ceil(total / take) } };
  }

  async get(id: string, user: AuthUser, includeDeleted = false): Promise<Invoice> {
    return this.findForUser(id, user, includeDeleted);
  }

  async create(dto: SaveInvoiceDto, user: AuthUser): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(Customer).findOne({ where: { id: dto.customerId, ownerId: user.id, archivedAt: IsNull() } });
      if (!customer) throw new BadRequestException('Aktiver Kunde nicht gefunden');
      const company = await manager.getRepository(CompanySettings).createQueryBuilder('settings')
        .addSelect('settings.logoDataUrl').where('settings.userId = :userId', { userId: user.id }).getOne();
      if (!company) throw new BadRequestException('Firmeneinstellungen fehlen');
      const totals = this.money.calculate(dto.items);
      const invoiceNumber = dto.invoiceNumber?.trim() || await this.nextInvoiceNumber(manager, company.invoicePrefix, dto.invoiceDate);
      const invoice = await manager.getRepository(Invoice).save(manager.getRepository(Invoice).create({
        ownerId: user.id,
        customerId: customer.id,
        invoiceNumber,
        invoiceDate: dto.invoiceDate,
        serviceStart: dto.serviceStart,
        serviceEnd: dto.serviceEnd ?? null,
        dueDate: dto.dueDate,
        status: InvoiceStatus.DRAFT,
        currency: dto.currency,
        reference: this.optional(dto.reference),
        introductionText: this.optional(dto.introductionText),
        closingText: this.optional(dto.closingText),
        internalNotes: this.optional(dto.internalNotes),
        companySnapshot: this.companySnapshot(company),
        customerSnapshot: this.customerSnapshot(customer),
        netMinor: totals.netMinor,
        taxMinor: totals.taxMinor,
        grossMinor: totals.grossMinor,
        currentVersion: 1,
        searchText: this.searchText(invoiceNumber, customer, dto.reference),
        finalizedAt: null,
        deletedAt: null,
        deletedById: null,
        purgeAfter: null,
      }));
      invoice.items = await this.replaceItems(manager, invoice.id, totals);
      await manager.getRepository(InvoiceVersion).save({
        invoiceId: invoice.id, versionNumber: 1, changedById: user.id, changeReason: dto.changeReason?.trim() || 'Rechnung erstellt', snapshot: this.snapshot(invoice),
      });
      await manager.getRepository(InvoiceStatusHistory).save({ invoiceId: invoice.id, fromStatus: null, toStatus: InvoiceStatus.DRAFT, changedById: user.id, reason: 'Rechnung erstellt' });
      await this.audit.record({ userId: user.id, action: 'INVOICE_CREATED', entityType: 'Invoice', entityId: invoice.id, metadata: { invoiceNumber } }, manager);
      return invoice;
    }).catch((error: unknown) => this.mapConstraint(error));
  }

  async update(id: string, dto: SaveInvoiceDto, user: AuthUser): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await this.findForUser(id, user, false, manager, true);
      this.policy.assertVersion(dto.expectedVersion, invoice.currentVersion);
      this.policy.assertChangeReason(invoice.status, dto.changeReason);
      const customer = await manager.getRepository(Customer).findOne({ where: { id: dto.customerId, ownerId: invoice.ownerId } });
      if (!customer) throw new BadRequestException('Kunde nicht gefunden');
      const totals = this.money.calculate(dto.items);
      const previousCustomerId = invoice.customerId;
      invoice.customerId = customer.id;
      if (previousCustomerId !== customer.id) invoice.customerSnapshot = this.customerSnapshot(customer);
      invoice.invoiceNumber = dto.invoiceNumber?.trim() || invoice.invoiceNumber;
      invoice.invoiceDate = dto.invoiceDate;
      invoice.serviceStart = dto.serviceStart;
      invoice.serviceEnd = dto.serviceEnd ?? null;
      invoice.dueDate = dto.dueDate;
      invoice.currency = dto.currency;
      invoice.reference = this.optional(dto.reference);
      invoice.introductionText = this.optional(dto.introductionText);
      invoice.closingText = this.optional(dto.closingText);
      invoice.internalNotes = this.optional(dto.internalNotes);
      invoice.netMinor = totals.netMinor;
      invoice.taxMinor = totals.taxMinor;
      invoice.grossMinor = totals.grossMinor;
      invoice.searchText = this.searchText(invoice.invoiceNumber, customer, dto.reference);
      invoice.currentVersion += 1;
      await manager.getRepository(Invoice).save(invoice);
      invoice.items = await this.replaceItems(manager, invoice.id, totals);
      await manager.getRepository(InvoiceVersion).save({
        invoiceId: invoice.id, versionNumber: invoice.currentVersion, changedById: user.id,
        changeReason: dto.changeReason?.trim() || 'Rechnung bearbeitet', snapshot: this.snapshot(invoice),
      });
      await this.audit.record({ userId: user.id, action: 'INVOICE_UPDATED', entityType: 'Invoice', entityId: invoice.id, metadata: { version: invoice.currentVersion } }, manager);
      return invoice;
    }).catch((error: unknown) => this.mapConstraint(error));
  }

  async changeStatus(id: string, dto: ChangeStatusDto, user: AuthUser): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await this.findForUser(id, user, false, manager, true);
      this.policy.assertVersion(dto.expectedVersion, invoice.currentVersion);
      if (!allowedStatusTransitions[invoice.status].includes(dto.status)) throw new BadRequestException(`Statuswechsel von ${invoice.status} nach ${dto.status} ist nicht erlaubt`);
      const previous = invoice.status;
      invoice.status = dto.status;
      invoice.currentVersion += 1;
      if (dto.status === InvoiceStatus.FINALIZED) invoice.finalizedAt = new Date();
      await manager.getRepository(Invoice).save(invoice);
      await manager.getRepository(InvoiceStatusHistory).save({ invoiceId: id, fromStatus: previous, toStatus: dto.status, changedById: user.id, reason: this.optional(dto.reason) });
      await manager.getRepository(InvoiceVersion).save({
        invoiceId: id, versionNumber: invoice.currentVersion, changedById: user.id,
        changeReason: dto.reason?.trim() || `Status: ${previous} → ${dto.status}`, snapshot: this.snapshot(invoice),
      });
      await this.audit.record({ userId: user.id, action: 'INVOICE_STATUS_CHANGED', entityType: 'Invoice', entityId: id, metadata: { from: previous, to: dto.status } }, manager);
      return invoice;
    });
  }

  async duplicate(id: string, user: AuthUser): Promise<Invoice> {
    const source = await this.findForUser(id, user, false);
    const today = new Date().toISOString().slice(0, 10);
    const dto: SaveInvoiceDto = {
      customerId: source.customerId!, invoiceDate: today, serviceStart: today, dueDate: this.addDays(today, 14), currency: source.currency,
      reference: source.reference ?? undefined, introductionText: source.introductionText ?? undefined,
      closingText: source.closingText ?? undefined, internalNotes: source.internalNotes ?? undefined,
      items: source.items.map((item) => ({
        description: item.description, quantity: item.quantity, unit: item.unit, unitPriceMinor: item.unitPriceMinor,
        discountBasisPoints: item.discountBasisPoints, taxRateBasisPoints: item.taxRateBasisPoints,
      })), changeReason: `Duplikat von ${source.invoiceNumber}`,
    };
    const duplicate = await this.create(dto, user);
    await this.audit.record({ userId: user.id, action: 'INVOICE_DUPLICATED', entityType: 'Invoice', entityId: duplicate.id, metadata: { sourceId: id } });
    return duplicate;
  }

  async softDelete(id: string, user: AuthUser): Promise<{ purgeAfter: Date }> {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await this.findForUser(id, user, false, manager, true);
      const retention = this.config.get<number>('TRASH_RETENTION_DAYS', 30);
      const window = this.policy.trashWindow(new Date(), retention);
      invoice.deletedAt = window.deletedAt;
      invoice.deletedById = user.id;
      invoice.purgeAfter = window.purgeAfter;
      invoice.currentVersion += 1;
      await manager.getRepository(Invoice).save(invoice);
      await manager.getRepository(InvoiceVersion).save({ invoiceId: id, versionNumber: invoice.currentVersion, changedById: user.id, changeReason: 'In Papierkorb verschoben', snapshot: this.snapshot(invoice) });
      await this.audit.record({ userId: user.id, action: 'INVOICE_DELETED', entityType: 'Invoice', entityId: id, metadata: { purgeAfter: invoice.purgeAfter.toISOString() } }, manager);
      return { purgeAfter: invoice.purgeAfter };
    });
  }

  async restoreDeleted(id: string, user: AuthUser): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await this.findForUser(id, user, true, manager, true);
      if (!invoice.deletedAt) throw new BadRequestException('Rechnung befindet sich nicht im Papierkorb');
      invoice.deletedAt = null;
      invoice.deletedById = null;
      invoice.purgeAfter = null;
      invoice.currentVersion += 1;
      await manager.getRepository(Invoice).save(invoice);
      await manager.getRepository(InvoiceVersion).save({ invoiceId: id, versionNumber: invoice.currentVersion, changedById: user.id, changeReason: 'Aus Papierkorb wiederhergestellt', snapshot: this.snapshot(invoice) });
      await this.audit.record({ userId: user.id, action: 'INVOICE_RESTORED', entityType: 'Invoice', entityId: id }, manager);
      return invoice;
    });
  }

  async trash(user: AuthUser, page = 1, pageSize = 25) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const query = this.invoices.createQueryBuilder('invoice').leftJoinAndSelect('invoice.deletedBy', 'deletedBy').where('invoice.deletedAt IS NOT NULL');
    if (!this.isAdmin(user)) query.andWhere('invoice.ownerId = :ownerId', { ownerId: user.id });
    const [data, total] = await query.orderBy('invoice.deletedAt', 'DESC').skip((Math.max(page, 1) - 1) * take).take(take).getManyAndCount();
    return { data, meta: { page, pageSize: take, total, totalPages: Math.ceil(total / take) } };
  }

  async listVersions(id: string, user: AuthUser): Promise<InvoiceVersion[]> {
    await this.findForUser(id, user, true);
    return this.versions.find({ where: { invoiceId: id }, relations: { changedBy: true }, order: { versionNumber: 'DESC' } });
  }

  async version(id: string, versionNumber: number, user: AuthUser): Promise<InvoiceVersion> {
    await this.findForUser(id, user, true);
    const version = await this.versions.findOne({ where: { invoiceId: id, versionNumber }, relations: { changedBy: true } });
    if (!version) throw new NotFoundException('Version nicht gefunden');
    return version;
  }

  async compareVersions(id: string, from: number, to: number, user: AuthUser) {
    const [a, b] = await Promise.all([this.version(id, from, user), this.version(id, to, user)]);
    const aSnapshot = a.snapshot as StoredSnapshot;
    const bSnapshot = b.snapshot as StoredSnapshot;
    const keys = new Set([...Object.keys(aSnapshot.invoice), ...Object.keys(bSnapshot.invoice)]);
    const changes = [...keys].filter((key) => JSON.stringify(aSnapshot.invoice[key]) !== JSON.stringify(bSnapshot.invoice[key]))
      .map((field) => ({ field, before: aSnapshot.invoice[field] ?? null, after: bSnapshot.invoice[field] ?? null }));
    if (JSON.stringify(aSnapshot.items) !== JSON.stringify(bSnapshot.items)) changes.push({ field: 'items', before: aSnapshot.items, after: bSnapshot.items });
    return { from: a, to: b, changes };
  }

  async restoreVersion(id: string, versionNumber: number, dto: RestoreVersionDto, user: AuthUser): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const invoice = await this.findForUser(id, user, true, manager, true);
      this.policy.assertVersion(dto.expectedVersion, invoice.currentVersion);
      const version = await manager.getRepository(InvoiceVersion).findOne({ where: { invoiceId: id, versionNumber } });
      if (!version) throw new NotFoundException('Version nicht gefunden');
      const stored = version.snapshot as StoredSnapshot;
      const old = stored.invoice;
      const inputItems: InvoiceItemDto[] = stored.items.map((item) => ({
        description: String(item.description), quantity: String(item.quantity), unit: String(item.unit), unitPriceMinor: String(item.unitPriceMinor),
        discountBasisPoints: Number(item.discountBasisPoints), taxRateBasisPoints: Number(item.taxRateBasisPoints),
      }));
      const totals = this.money.calculate(inputItems);
      const previousStatus = invoice.status;
      invoice.customerId = typeof old.customerId === 'string' ? old.customerId : null;
      invoice.invoiceDate = String(old.invoiceDate);
      invoice.serviceStart = String(old.serviceStart);
      invoice.serviceEnd = old.serviceEnd ? String(old.serviceEnd) : null;
      invoice.dueDate = String(old.dueDate);
      invoice.status = old.status as InvoiceStatus;
      invoice.currency = String(old.currency);
      invoice.reference = old.reference ? String(old.reference) : null;
      invoice.introductionText = old.introductionText ? String(old.introductionText) : null;
      invoice.closingText = old.closingText ? String(old.closingText) : null;
      invoice.internalNotes = old.internalNotes ? String(old.internalNotes) : null;
      invoice.companySnapshot = old.companySnapshot as JsonObject;
      invoice.customerSnapshot = old.customerSnapshot as JsonObject;
      invoice.searchText = [invoice.invoiceNumber, ...Object.values(invoice.customerSnapshot), invoice.reference].filter((value) => typeof value === 'string' && value).join(' ');
      invoice.netMinor = totals.netMinor; invoice.taxMinor = totals.taxMinor; invoice.grossMinor = totals.grossMinor;
      invoice.deletedAt = null; invoice.deletedById = null; invoice.purgeAfter = null;
      invoice.currentVersion += 1;
      await manager.getRepository(Invoice).save(invoice);
      invoice.items = await this.replaceItems(manager, id, totals);
      await manager.getRepository(InvoiceVersion).save({ invoiceId: id, versionNumber: invoice.currentVersion, changedById: user.id, changeReason: dto.reason.trim(), snapshot: this.snapshot(invoice) });
      if (previousStatus !== invoice.status) await manager.getRepository(InvoiceStatusHistory).save({ invoiceId: id, fromStatus: previousStatus, toStatus: invoice.status, changedById: user.id, reason: dto.reason.trim() });
      await this.audit.record({ userId: user.id, action: 'INVOICE_VERSION_RESTORED', entityType: 'Invoice', entityId: id, metadata: { restoredVersion: versionNumber, newVersion: invoice.currentVersion } }, manager);
      return invoice;
    });
  }

  @Cron('0 3 * * *')
  async purgeExpired(): Promise<number> {
    const expired = await this.invoices.find({ where: { purgeAfter: LessThanOrEqual(new Date()), deletedAt: Not(IsNull()) }, select: { id: true }, take: 100 });
    if (!expired.length) return 0;
    await this.dataSource.transaction(async (manager) => {
      for (const invoice of expired) await manager.getRepository(Invoice).delete(invoice.id);
      await this.audit.record({ userId: null, action: 'TRASH_PURGED', entityType: 'Invoice', metadata: { count: expired.length } }, manager);
    });
    return expired.length;
  }

  private async replaceItems(manager: EntityManager, invoiceId: string, totals: CalculationResult): Promise<InvoiceItem[]> {
    const repo = manager.getRepository(InvoiceItem);
    await repo.delete({ invoiceId });
    return repo.save(totals.items.map((item) => repo.create({ ...item, invoiceId })));
  }

  private async findForUser(id: string, user: AuthUser, includeDeleted: boolean, manager = this.dataSource.manager, lock = false): Promise<Invoice> {
    const query = manager.getRepository(Invoice).createQueryBuilder('invoice').leftJoinAndSelect('invoice.items', 'item').where('invoice.id = :id', { id });
    if (!this.isAdmin(user)) query.andWhere('invoice.ownerId = :ownerId', { ownerId: user.id });
    if (!includeDeleted) query.andWhere('invoice.deletedAt IS NULL');
    if (lock) query.setLock('pessimistic_write');
    const invoice = await query.orderBy('item.position', 'ASC').getOne();
    if (!invoice) throw new NotFoundException('Rechnung nicht gefunden');
    return invoice;
  }

  private async nextInvoiceNumber(manager: EntityManager, rawPrefix: string, invoiceDate: string): Promise<string> {
    const year = Number(invoiceDate.slice(0, 4));
    if (!Number.isInteger(year)) throw new BadRequestException('Ungültiges Rechnungsdatum');
    const rows = await manager.query<Array<{ current_value: number }>>(
      `INSERT INTO invoice_sequences (year, current_value) VALUES ($1, 1)
       ON CONFLICT (year) DO UPDATE SET current_value = invoice_sequences.current_value + 1
       RETURNING current_value`, [year],
    );
    const prefix = rawPrefix.replace(/[^A-Z0-9-]/gi, '').slice(0, 20) || 'RE';
    return `${prefix}-${year}-${String(rows[0]?.current_value ?? 1).padStart(4, '0')}`;
  }

  private snapshot(invoice: Invoice): StoredSnapshot {
    return {
      invoice: {
        id: invoice.id, ownerId: invoice.ownerId, customerId: invoice.customerId, invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate, serviceStart: invoice.serviceStart, serviceEnd: invoice.serviceEnd, dueDate: invoice.dueDate,
        status: invoice.status, currency: invoice.currency, reference: invoice.reference, introductionText: invoice.introductionText,
        closingText: invoice.closingText, internalNotes: invoice.internalNotes, companySnapshot: invoice.companySnapshot,
        customerSnapshot: invoice.customerSnapshot, netMinor: invoice.netMinor, taxMinor: invoice.taxMinor,
        grossMinor: invoice.grossMinor, currentVersion: invoice.currentVersion, finalizedAt: invoice.finalizedAt?.toISOString() ?? null,
        deletedAt: invoice.deletedAt?.toISOString() ?? null, deletedById: invoice.deletedById, purgeAfter: invoice.purgeAfter?.toISOString() ?? null,
      },
      items: invoice.items.map((item) => ({
        position: item.position, description: item.description, quantity: item.quantity, unit: item.unit,
        unitPriceMinor: item.unitPriceMinor, discountBasisPoints: item.discountBasisPoints, taxRateBasisPoints: item.taxRateBasisPoints,
        netMinor: item.netMinor, taxMinor: item.taxMinor, grossMinor: item.grossMinor,
      })),
    };
  }

  private customerSnapshot(customer: Customer): JsonObject {
    return { name: customer.company || customer.name, contactName: customer.company ? customer.name : null, street: customer.street, postalCode: customer.postalCode, city: customer.city, country: customer.country, email: customer.email, phone: customer.phone, customerNumber: customer.customerNumber };
  }

  private companySnapshot(settings: CompanySettings): JsonObject {
    return { name: settings.companyName, street: settings.street, postalCode: settings.postalCode, city: settings.city, country: settings.country, email: settings.email, phone: settings.phone, taxId: settings.taxId, vatId: settings.vatId, bankName: settings.bankName, iban: settings.iban, bic: settings.bic, logoDataUrl: settings.logoDataUrl };
  }

  private searchText(invoiceNumber: string, customer: Customer, reference?: string): string {
    return [invoiceNumber, customer.name, customer.company, customer.customerNumber, customer.email, reference].filter(Boolean).join(' ');
  }

  private optional(value: string | undefined): string | null { return value?.trim() || null; }
  private isAdmin(user: AuthUser): boolean { return user.roles.includes('Administrator'); }
  private addDays(date: string, days: number): string { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }

  private mapConstraint(error: unknown): never {
    if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof ForbiddenException || error instanceof NotFoundException) throw error;
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505') throw new ConflictException('Rechnungsnummer ist bereits vergeben');
    throw error;
  }
}
