import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CsrfGuard } from '../src/common/guards/csrf.guard';

function context(request: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  const config = { getOrThrow: () => 'https://billing.example.com' } as unknown as ConfigService;
  const guard = new CsrfGuard(config);
  it('accepts a matching double-submit token', () => {
    assert.equal(guard.canActivate(context({ method: 'POST', headers: { origin: 'https://billing.example.com' }, cookies: { csrf_token: 'same-token' }, header: (key: string) => key === 'x-csrf-token' ? 'same-token' : undefined })), true);
  });
  it('rejects a foreign origin and missing token', () => {
    assert.throws(() => guard.canActivate(context({ method: 'POST', headers: { origin: 'https://evil.example' }, cookies: {}, header: () => undefined })), ForbiddenException);
    assert.throws(() => guard.canActivate(context({ method: 'POST', headers: {}, cookies: {}, header: () => undefined })), ForbiddenException);
  });
});
