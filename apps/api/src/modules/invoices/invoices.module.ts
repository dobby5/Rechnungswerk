import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice, InvoiceVersion } from '../../database/entities/entities';
import { AuditModule } from '../audit/audit.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { MoneyService } from './money.service';
import { InvoicePolicyService } from './invoice-policy.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoiceVersion]), AuditModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, MoneyService, InvoicePolicyService],
  exports: [InvoicesService, MoneyService],
})
export class InvoicesModule {}
