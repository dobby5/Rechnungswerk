import { InvoiceStatus } from '@rechnungswerk/shared';
import { BadRequestException, ConflictException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvoicePolicyService } from '../src/modules/invoices/invoice-policy.service';

describe('InvoicePolicyService', () => {
  const policy = new InvoicePolicyService();
  it('rejects stale writes', () => { assert.throws(() => policy.assertVersion(2, 3), ConflictException); });
  it('requires a reason for edits after finalization', () => { assert.throws(() => policy.assertChangeReason(InvoiceStatus.FINALIZED, ''), BadRequestException); assert.doesNotThrow(() => policy.assertChangeReason(InvoiceStatus.DRAFT, undefined)); });
  it('sets a precise 30 day restore window', () => { const now = new Date('2026-09-11T10:00:00Z'); const result = policy.trashWindow(now, 30); assert.equal(result.purgeAfter.toISOString(), '2026-10-11T10:00:00.000Z'); });
});
