import { InvoiceStatus } from '@rechnungswerk/shared';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Invoice } from '../src/database/entities/entities';
import { DocumentRenderService } from '../src/modules/documents/document-render.service';

const invoice = {
  id: '00000000-0000-4000-8000-000000000001', ownerId: '00000000-0000-4000-8000-000000000002', customerId: null,
  invoiceNumber: 'RE-2026-0001', invoiceDate: '2026-09-11', serviceStart: '2026-09-01', serviceEnd: '2026-09-10', dueDate: '2026-09-25',
  status: InvoiceStatus.FINALIZED, currency: 'EUR', reference: null, introductionText: 'Vielen Dank für Ihren Auftrag.', closingText: 'Bitte überweisen Sie fristgerecht.', internalNotes: null,
  companySnapshot: { name: 'Rechnungswerk GmbH', street: 'Werkstraße 1', postalCode: '10115', city: 'Berlin', country: 'DE', vatId: 'DE123456789', iban: 'DE02120300000000202051' },
  customerSnapshot: { name: 'Beispiel AG', street: 'Kundenweg 2', postalCode: '20095', city: 'Hamburg', country: 'DE' },
  netMinor: '20000', taxMinor: '3800', grossMinor: '23800', currentVersion: 2, searchText: '', finalizedAt: new Date(), deletedAt: null, deletedById: null, purgeAfter: null,
  items: [{ id: 'item', invoiceId: 'invoice', position: 1, description: 'Konzeption und Umsetzung', quantity: '2.0000', unit: 'Tag', unitPriceMinor: '10000', discountBasisPoints: 0, taxRateBasisPoints: 1900, netMinor: '20000', taxMinor: '3800', grossMinor: '23800' }],
} as unknown as Invoice;

describe('DocumentRenderService', () => {
  const renderer = new DocumentRenderService();
  it('generates a non-empty PDF', async () => { const value = await renderer.pdf(invoice); assert.equal(value.subarray(0, 4).toString(), '%PDF'); assert.ok(value.length > 1000); });
  it('generates an Office Open XML document', async () => { const value = await renderer.docx(invoice); assert.equal(value.subarray(0, 2).toString(), 'PK'); assert.ok(value.length > 1000); });
});
