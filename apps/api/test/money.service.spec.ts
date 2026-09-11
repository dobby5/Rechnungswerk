import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MoneyService } from '../src/modules/invoices/money.service';

describe('MoneyService', () => {
  const service = new MoneyService();

  it('calculates quantity, discount and German VAT without floating point', () => {
    const result = service.calculate([{ description: 'Beratung', quantity: '2.5000', unit: 'h', unitPriceMinor: '12345', discountBasisPoints: 1000, taxRateBasisPoints: 1900 }]);
    assert.deepEqual({ netMinor: result.items[0]?.netMinor, taxMinor: result.items[0]?.taxMinor, grossMinor: result.items[0]?.grossMinor }, { netMinor: '27776', taxMinor: '5277', grossMinor: '33053' });
    assert.equal(result.grossMinor, '33053');
  });

  it('rounds half a minor unit deterministically', () => {
    const result = service.calculate([{ description: 'Kleinbetrag', quantity: '0.5000', unit: 'Stk.', unitPriceMinor: '1', discountBasisPoints: 0, taxRateBasisPoints: 0 }]);
    assert.equal(result.netMinor, '1');
  });

  it('sums tax per rounded line item', () => {
    const result = service.calculate([
      { description: 'A', quantity: '1', unit: 'Stk.', unitPriceMinor: '1', discountBasisPoints: 0, taxRateBasisPoints: 1900 },
      { description: 'B', quantity: '1', unit: 'Stk.', unitPriceMinor: '3', discountBasisPoints: 0, taxRateBasisPoints: 700 },
    ]);
    assert.deepEqual({ netMinor: result.netMinor, taxMinor: result.taxMinor, grossMinor: result.grossMinor }, { netMinor: '4', taxMinor: '0', grossMinor: '4' });
    assert.equal(result.taxBreakdown.length, 2);
  });
});
