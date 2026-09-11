import { BadRequestException, Injectable } from '@nestjs/common';
import { InvoiceItemDto } from './invoice.dto';

export interface CalculatedItem extends InvoiceItemDto {
  position: number;
  netMinor: string;
  taxMinor: string;
  grossMinor: string;
}

export interface CalculationResult {
  items: CalculatedItem[];
  netMinor: string;
  taxMinor: string;
  grossMinor: string;
  taxBreakdown: Array<{ taxRateBasisPoints: number; netMinor: string; taxMinor: string }>;
}

const QUANTITY_SCALE = 10_000n;
const BASIS_POINTS = 10_000n;

@Injectable()
export class MoneyService {
  calculate(items: InvoiceItemDto[]): CalculationResult {
    if (!items.length) throw new BadRequestException('Mindestens eine Rechnungsposition ist erforderlich');
    const calculated = items.map((item, index) => this.calculateItem(item, index + 1));
    const buckets = new Map<number, { net: bigint; tax: bigint }>();
    let net = 0n;
    let tax = 0n;
    for (const item of calculated) {
      const itemNet = BigInt(item.netMinor);
      const itemTax = BigInt(item.taxMinor);
      net += itemNet;
      tax += itemTax;
      const bucket = buckets.get(item.taxRateBasisPoints) ?? { net: 0n, tax: 0n };
      bucket.net += itemNet;
      bucket.tax += itemTax;
      buckets.set(item.taxRateBasisPoints, bucket);
    }
    return {
      items: calculated,
      netMinor: net.toString(),
      taxMinor: tax.toString(),
      grossMinor: (net + tax).toString(),
      taxBreakdown: [...buckets.entries()].sort(([a], [b]) => a - b).map(([taxRateBasisPoints, value]) => ({
        taxRateBasisPoints, netMinor: value.net.toString(), taxMinor: value.tax.toString(),
      })),
    };
  }

  private calculateItem(item: InvoiceItemDto, position: number): CalculatedItem {
    const quantity = this.parseQuantity(item.quantity);
    const unitPrice = BigInt(item.unitPriceMinor);
    const discountFactor = BASIS_POINTS - BigInt(item.discountBasisPoints);
    const net = this.divideRounded(unitPrice * quantity * discountFactor, QUANTITY_SCALE * BASIS_POINTS);
    const tax = this.divideRounded(net * BigInt(item.taxRateBasisPoints), BASIS_POINTS);
    if (net > 9_000_000_000_000_000n) throw new BadRequestException('Positionsbetrag überschreitet das zulässige Maximum');
    return {
      description: item.description.trim(), quantity: item.quantity, unit: item.unit.trim(), unitPriceMinor: unitPrice.toString(),
      discountBasisPoints: item.discountBasisPoints, taxRateBasisPoints: item.taxRateBasisPoints,
      position, netMinor: net.toString(), taxMinor: tax.toString(), grossMinor: (net + tax).toString(),
    };
  }

  private parseQuantity(value: string): bigint {
    const [whole = '', fraction = ''] = value.split('.');
    const normalized = `${whole}${fraction.padEnd(4, '0')}`;
    const quantity = BigInt(normalized);
    if (quantity <= 0n) throw new BadRequestException('Menge muss größer als null sein');
    return quantity;
  }

  private divideRounded(numerator: bigint, denominator: bigint): bigint {
    return (numerator + denominator / 2n) / denominator;
  }
}
