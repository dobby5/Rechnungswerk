import { SetMetadata } from '@nestjs/common';
import { PermissionValue } from '../types/auth-user';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: PermissionValue[]): MethodDecorator & ClassDecorator => SetMetadata(PERMISSIONS_KEY, permissions);
