import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}
  @Public()
  @Get()
  async health(): Promise<{ status: 'ok'; database: 'up'; timestamp: string }> {
    try { await this.dataSource.query('SELECT 1'); }
    catch { throw new ServiceUnavailableException('Datenbank nicht erreichbar'); }
    return { status: 'ok', database: 'up', timestamp: new Date().toISOString() };
  }
}
