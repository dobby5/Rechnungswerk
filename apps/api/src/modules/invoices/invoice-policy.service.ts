import { InvoiceStatus } from '@rechnungswerk/shared';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';

const PROTECTED = new Set([InvoiceStatus.FINALIZED, InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.CANCELLED]);

@Injectable()
export class InvoicePolicyService {
  assertVersion(expected: number | undefined, current: number): void {
    if (expected !== undefined && expected !== current) throw new ConflictException('Die Rechnung wurde zwischenzeitlich geändert');
  }

  assertChangeReason(status: InvoiceStatus, reason: string | undefined): void {
    if (PROTECTED.has(status) && !reason?.trim()) throw new BadRequestException('Für Änderungen an finalisierten oder steuerlich relevanten Rechnungen ist ein Änderungsgrund erforderlich');
  }

  trashWindow(now: Date, retentionDays: number): { deletedAt: Date; purgeAfter: Date } {
    return { deletedAt: now, purgeAfter: new Date(now.getTime() + retentionDays * 86_400_000) };
  }
}
