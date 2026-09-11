export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  FINALIZED = 'FINALIZED',
  SENT = 'SENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: 'Entwurf',
  [InvoiceStatus.FINALIZED]: 'Finalisiert',
  [InvoiceStatus.SENT]: 'Versendet',
  [InvoiceStatus.PAID]: 'Bezahlt',
  [InvoiceStatus.CANCELLED]: 'Storniert',
};

export const allowedStatusTransitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.FINALIZED, InvoiceStatus.CANCELLED],
  [InvoiceStatus.FINALIZED]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
  [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
  [InvoiceStatus.PAID]: [InvoiceStatus.CANCELLED],
  [InvoiceStatus.CANCELLED]: [],
};

export interface AddressSnapshot {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  email?: string;
  phone?: string;
  customerNumber?: string;
  taxId?: string;
  vatId?: string;
  bankName?: string;
  iban?: string;
  bic?: string;
  logoDataUrl?: string;
}

export interface InvoiceItemInput {
  description: string;
  quantity: string;
  unit: string;
  unitPriceMinor: string;
  discountBasisPoints: number;
  taxRateBasisPoints: number;
}

export interface InvoiceTotals {
  netMinor: string;
  taxMinor: string;
  grossMinor: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PagedResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface ApiErrorShape {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
  timestamp: string;
}
