import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionKey } from '../../common/types/auth-user';
import { AuditLog } from '../../database/entities/entities';

@Controller('audit-logs')
@Permissions(PermissionKey.AuditRead)
export class AuditController {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  @Get()
  async list(@Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize = 25) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const [data, total] = await this.logs.findAndCount({ relations: { user: true }, order: { createdAt: 'DESC' }, take, skip: (Math.max(page, 1) - 1) * take });
    return { data, meta: { page, pageSize: take, total, totalPages: Math.ceil(total / take) } };
  }
}
