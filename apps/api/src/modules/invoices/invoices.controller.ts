import { InvoiceStatus } from '@rechnungswerk/shared';
import {
  Body, Controller, Delete, Get, Param, ParseEnumPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser, PermissionKey } from '../../common/types/auth-user';
import { ChangeStatusDto, RestoreVersionDto, SaveInvoiceDto } from './invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@Permissions(PermissionKey.InvoiceRead)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 25,
    @Query('search') search?: string,
    @Query('customerId') customerId?: string,
    @Query('status', new ParseEnumPipe(InvoiceStatus, { optional: true })) status?: InvoiceStatus,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('invoiceNumber') invoiceNumber?: string,
    @Query('userId') userId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) { return this.invoices.list(user, { page, pageSize, search, customerId, status, dateFrom, dateTo, invoiceNumber, userId, sortBy, sortOrder }); }

  @Get('trash')
  getTrash(@CurrentUser() user: AuthUser, @Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 25) {
    return this.invoices.trash(user, page, pageSize);
  }

  @Post('trash/purge-expired')
  @Permissions(PermissionKey.TrashManage)
  async purgeExpired() { return { purged: await this.invoices.purgeExpired() }; }

  @Get(':id/versions')
  versions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.invoices.listVersions(id, user); }

  @Get(':id/versions/compare')
  compare(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from', ParseIntPipe) from: number,
    @Query('to', ParseIntPipe) to: number,
    @CurrentUser() user: AuthUser,
  ) { return this.invoices.compareVersions(id, from, to, user); }

  @Get(':id/versions/:version')
  version(@Param('id', ParseUUIDPipe) id: string, @Param('version', ParseIntPipe) version: number, @CurrentUser() user: AuthUser) { return this.invoices.version(id, version, user); }

  @Post(':id/versions/:version/restore')
  @Permissions(PermissionKey.InvoiceWrite)
  restoreVersion(@Param('id', ParseUUIDPipe) id: string, @Param('version', ParseIntPipe) version: number, @Body() dto: RestoreVersionDto, @CurrentUser() user: AuthUser) {
    return this.invoices.restoreVersion(id, version, dto, user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.invoices.get(id, user); }

  @Post()
  @Permissions(PermissionKey.InvoiceWrite)
  create(@Body() dto: SaveInvoiceDto, @CurrentUser() user: AuthUser) { return this.invoices.create(dto, user); }

  @Patch(':id')
  @Permissions(PermissionKey.InvoiceWrite)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveInvoiceDto, @CurrentUser() user: AuthUser) { return this.invoices.update(id, dto, user); }

  @Post(':id/status')
  @Permissions(PermissionKey.InvoiceWrite)
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeStatusDto, @CurrentUser() user: AuthUser) { return this.invoices.changeStatus(id, dto, user); }

  @Post(':id/duplicate')
  @Permissions(PermissionKey.InvoiceWrite)
  duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.invoices.duplicate(id, user); }

  @Delete(':id')
  @Permissions(PermissionKey.InvoiceDelete)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.invoices.softDelete(id, user); }

  @Post(':id/restore')
  @Permissions(PermissionKey.InvoiceDelete)
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.invoices.restoreDeleted(id, user); }
}
