import { BadRequestException, Injectable } from '@nestjs/common';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { AuthUser } from '../../common/types/auth-user';
import { AuditService } from '../audit/audit.service';
import { InvoicesService } from '../invoices/invoices.service';
import { DocumentRenderService } from './document-render.service';

export type DocumentFormat = 'pdf' | 'docx';

@Injectable()
export class DocumentsService {
  constructor(private readonly invoices: InvoicesService, private readonly render: DocumentRenderService, private readonly audit: AuditService) {}

  async generate(id: string, format: DocumentFormat, user: AuthUser): Promise<{ buffer: Buffer; filename: string; mime: string }> {
    const invoice = await this.invoices.get(id, user);
    const buffer = format === 'pdf' ? await this.render.pdf(invoice) : await this.render.docx(invoice);
    const filename = `${this.safe(invoice.invoiceNumber)}.${format}`;
    await this.audit.record({ userId: user.id, action: 'DOCUMENT_GENERATED', entityType: 'Invoice', entityId: id, metadata: { format } });
    return { buffer, filename, mime: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }

  zip(ids: string[], format: 'pdf' | 'docx' | 'both', user: AuthUser): PassThrough {
    if (!ids.length || ids.length > 100) throw new BadRequestException('Zwischen 1 und 100 Rechnungen auswählen');
    const output = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (error) => output.destroy(error));
    archive.pipe(output);
    void (async () => {
      try {
        for (const id of [...new Set(ids)]) {
          const formats: DocumentFormat[] = format === 'both' ? ['pdf', 'docx'] : [format];
          for (const selected of formats) {
            const document = await this.generate(id, selected, user);
            archive.append(document.buffer, { name: document.filename });
          }
        }
        await this.audit.record({ userId: user.id, action: 'INVOICE_EXPORTED', entityType: 'Invoice', metadata: { count: ids.length, format } });
        await archive.finalize();
      } catch (error) { archive.abort(); output.destroy(error as Error); }
    })();
    return output;
  }

  private safe(value: string): string { return value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 100) || 'Rechnung'; }
}
