import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PasswordService } from '../src/modules/auth/password.service';

describe('PasswordService', () => {
  const service = new PasswordService();
  it('stores Argon2id hashes and verifies only the correct password', async () => {
    const hash = await service.hash('A-secure-test-password!');
    assert.ok(hash.includes('$argon2id$'));
    assert.equal(await service.verify(hash, 'A-secure-test-password!'), true);
    assert.equal(await service.verify(hash, 'wrong-password'), false);
  });
});
