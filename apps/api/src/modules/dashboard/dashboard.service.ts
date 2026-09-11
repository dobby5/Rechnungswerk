import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InvoiceStatus } from '@rechnungswerk/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/types/auth-user';
import { Invoice } from '../../database/entities/entities';

@Injectable()
export class DashboardService {
  constructor(@InjectRepository(Invoice) private readonly invoices: Repository<Invoice>) {}

  async get(user: AuthUser) {
    const ownerClause = user.roles.includes('Administrator') ? '' : 'AND i.owner_id = $1';
    const params = user.roles.includes('Administrator') ? [] : [user.id];
    const rows = await this.invoices.query<Array<Record<string, string>>>(`
      SELECT
        COUNT(*) FILTER (WHERE date_trunc('month', i.invoice_date) = date_trunc('month', CURRENT_DATE))::text AS "monthCount",
        COUNT(*) FILTER (WHERE i.status IN ('FINALIZED','SENT'))::text AS "openCount",
        COUNT(*) FILTER (WHERE i.status = 'PAID')::text AS "paidCount",
        COUNT(*) FILTER (WHERE i.status IN ('FINALIZED','SENT') AND i.due_date < CURRENT_DATE)::text AS "overdueCount",
        COALESCE(SUM(i.gross_minor) FILTER (WHERE i.status = 'PAID' AND date_trunc('year', i.invoice_date) = date_trunc('year', CURRENT_DATE)),0)::text AS "revenueMinor",
        COALESCE(SUM(i.gross_minor) FILTER (WHERE i.status IN ('FINALIZED','SENT') AND i.due_date < CURRENT_DATE),0)::text AS "overdueMinor"
      FROM invoices i WHERE i.deleted_at IS NULL ${ownerClause}`, params);
    const recentQuery = this.invoices.createQueryBuilder('invoice').where('invoice.deletedAt IS NULL');
    if (!user.roles.includes('Administrator')) recentQuery.andWhere('invoice.ownerId = :ownerId', { ownerId: user.id });
    const recent = await recentQuery.orderBy('invoice.updatedAt', 'DESC').take(6).getMany();
    return { metrics: rows[0] ?? { monthCount: '0', openCount: '0', paidCount: '0', overdueCount: '0', revenueMinor: '0', overdueMinor: '0' }, recent };
  }
}
