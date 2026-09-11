import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allowedStatusTransitions, InvoiceStatus } from './index';

describe('invoice status workflow', () => {
  it('allows the legal forward workflow', () => {
    assert.ok(allowedStatusTransitions[InvoiceStatus.DRAFT].includes(InvoiceStatus.FINALIZED));
    assert.ok(allowedStatusTransitions[InvoiceStatus.FINALIZED].includes(InvoiceStatus.SENT));
    assert.ok(allowedStatusTransitions[InvoiceStatus.SENT].includes(InvoiceStatus.PAID));
  });
  it('does not silently reopen paid or cancelled invoices', () => {
    assert.ok(!allowedStatusTransitions[InvoiceStatus.PAID].includes(InvoiceStatus.DRAFT));
    assert.equal(allowedStatusTransitions[InvoiceStatus.CANCELLED].length, 0);
  });
});
