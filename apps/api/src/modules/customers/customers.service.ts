import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuthUser } from '../../common/types/auth-user';
import { Customer } from '../../database/entities/entities';
import { AuditService } from '../audit/audit.service';
import { CustomerDto } from './customers.dto';

@Injectable()
export class CustomersService {
  constructor(@InjectRepository(Customer) private readonly customers: Repository<Customer>, private readonly audit: AuditService) {}

  async list(user: AuthUser, search = '', includeArchived = false, page = 1, pageSize = 25) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const query = this.customers.createQueryBuilder('customer').where('customer.ownerId = :ownerId', { ownerId: user.id });
    if (!includeArchived) query.andWhere('customer.archivedAt IS NULL');
    if (search.trim()) {
      query.andWhere(new Brackets((where) => where
        .where('customer.name ILIKE :search', { search: `%${search.trim()}%` })
        .orWhere('customer.company ILIKE :search', { search: `%${search.trim()}%` })
        .orWhere('customer.customerNumber ILIKE :search', { search: `%${search.trim()}%` })
        .orWhere('customer.email ILIKE :search', { search: `%${search.trim()}%` })));
    }
    query.orderBy('customer.name', 'ASC').skip((Math.max(page, 1) - 1) * take).take(take);
    const [data, total] = await query.getManyAndCount();
    return { data, meta: { page, pageSize: take, total, totalPages: Math.ceil(total / take) } };
  }

  async get(id: string, user: AuthUser): Promise<Customer> {
    const customer = await this.customers.findOne({ where: { id, ownerId: user.id } });
    if (!customer) throw new NotFoundException('Kunde nicht gefunden');
    return customer;
  }

  async create(dto: CustomerDto, user: AuthUser): Promise<Customer> {
    const customer = await this.customers.save(this.customers.create({ ...this.normalize(dto), ownerId: user.id, archivedAt: null }));
    await this.audit.record({ userId: user.id, action: 'CUSTOMER_CREATED', entityType: 'Customer', entityId: customer.id });
    return customer;
  }

  async update(id: string, dto: CustomerDto, user: AuthUser): Promise<Customer> {
    const customer = await this.get(id, user);
    Object.assign(customer, this.normalize(dto));
    const saved = await this.customers.save(customer);
    await this.audit.record({ userId: user.id, action: 'CUSTOMER_UPDATED', entityType: 'Customer', entityId: id });
    return saved;
  }

  async setArchived(id: string, archived: boolean, user: AuthUser): Promise<Customer> {
    const customer = await this.get(id, user);
    customer.archivedAt = archived ? new Date() : null;
    const saved = await this.customers.save(customer);
    await this.audit.record({ userId: user.id, action: archived ? 'CUSTOMER_ARCHIVED' : 'CUSTOMER_RESTORED', entityType: 'Customer', entityId: id });
    return saved;
  }

  private normalize(dto: CustomerDto): Partial<Customer> {
    return {
      customerNumber: dto.customerNumber?.trim() || null,
      name: dto.name.trim(),
      company: dto.company?.trim() || null,
      street: dto.street.trim(),
      postalCode: dto.postalCode.trim(),
      city: dto.city.trim(),
      country: dto.country.toUpperCase(),
      email: dto.email?.trim().toLowerCase() || null,
      phone: dto.phone?.trim() || null,
    };
  }
}
