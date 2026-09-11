import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { DocumentRenderService } from './document-render.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({ imports: [InvoicesModule, AuditModule], controllers: [DocumentsController], providers: [DocumentRenderService, DocumentsService], exports: [DocumentRenderService] })
export class DocumentsModule {}
