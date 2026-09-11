import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuthUser, PermissionKey } from '../../common/types/auth-user';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@Permissions(PermissionKey.InvoiceRead)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get() get(@CurrentUser() user: AuthUser) { return this.dashboard.get(user); }
}
