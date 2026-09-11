import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanySettings, Role, User } from '../../database/entities/entities';
import { AuditModule } from '../audit/audit.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SettingsController } from './settings.controller';
import { AuthModule } from '../auth/auth.module';

@Module({ imports: [TypeOrmModule.forFeature([User, Role, CompanySettings]), AuditModule, AuthModule], controllers: [UsersController, SettingsController], providers: [UsersService] })
export class UsersModule {}
