import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser, PermissionKey } from '../../common/types/auth-user';
import { BatchExportDto } from '../invoices/invoice.dto';
import { DocumentFormat, DocumentsService } from './documents.service';

@Controller('invoices')
@Permissions(PermissionKey.InvoiceExport)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get(':id/documents/:format')
  async document(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('format', new ParseEnumPipe({ pdf: 'pdf', docx: 'docx' })) format: DocumentFormat,
    @CurrentUser() user: AuthUser,
    @Res() response: Response,
  ): Promise<void> {
    const document = await this.documents.generate(id, format, user);
    response.set({ 'Content-Type': document.mime, 'Content-Disposition': `attachment; filename="${document.filename}"`, 'X-Content-Type-Options': 'nosniff' });
    response.send(document.buffer);
  }

  @Get(':id/export')
  zip(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Res() response: Response): void {
    response.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="Rechnung.zip"' });
    this.documents.zip([id], 'both', user).pipe(response);
  }

  @Post('batch-export')
  batch(@Body() dto: BatchExportDto, @CurrentUser() user: AuthUser, @Res() response: Response): void {
    response.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="Rechnungen.zip"' });
    this.documents.zip(dto.invoiceIds, dto.format, user).pipe(response);
  }
}
