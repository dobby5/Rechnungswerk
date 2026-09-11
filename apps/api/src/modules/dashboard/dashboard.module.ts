import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../../database/entities/entities';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({ imports: [TypeOrmModule.forFeature([Invoice])], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
