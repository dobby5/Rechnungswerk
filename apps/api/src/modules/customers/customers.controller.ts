import { Body, Controller, Get, Param, ParseBoolPipe, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser, PermissionKey } from '../../common/types/auth-user';
import { CustomerDto } from './customers.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
@Permissions(PermissionKey.CustomerManage)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}
  @Get() list(
    @CurrentUser() user: AuthUser,
    @Query('search') search = '',
    @Query('includeArchived', new ParseBoolPipe({ optional: true })) includeArchived = false,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 25,
  ) { return this.customers.list(user, search, includeArchived, page, pageSize); }
  @Get(':id') get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.customers.get(id, user); }
  @Post() create(@Body() dto: CustomerDto, @CurrentUser() user: AuthUser) { return this.customers.create(dto, user); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CustomerDto, @CurrentUser() user: AuthUser) { return this.customers.update(id, dto, user); }
  @Post(':id/archive') archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.customers.setArchived(id, true, user); }
  @Post(':id/unarchive') unarchive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.customers.setArchived(id, false, user); }
}
