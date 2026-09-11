import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PermissionKey } from '../src/common/types/auth-user';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';

describe('PermissionsGuard', () => {
  it('enforces every server-side permission', () => {
    const reflector = { getAllAndOverride: () => [PermissionKey.UserManage] } as unknown as Reflector;
    const context = { getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => ({ user: { permissions: [PermissionKey.InvoiceRead] } }) }) } as unknown as ExecutionContext;
    assert.throws(() => new PermissionsGuard(reflector).canActivate(context), ForbiddenException);
  });

  it('allows an authorized request', () => {
    const reflector = { getAllAndOverride: () => [PermissionKey.InvoiceRead] } as unknown as Reflector;
    const context = { getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => ({ user: { permissions: [PermissionKey.InvoiceRead] } }) }) } as unknown as ExecutionContext;
    assert.equal(new PermissionsGuard(reflector).canActivate(context), true);
  });
});
