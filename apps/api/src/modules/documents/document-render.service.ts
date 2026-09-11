import { Injectable } from '@nestjs/common';
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, Paragraph, ShadingType,
  Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';
import PDFDocument from 'pdfkit';
import { Invoice } from '../../database/entities/entities';

interface Party {
  name: string; contactName?: string; street: string; postalCode: string; city: string; country: string;
  email?: string; phone?: string; taxId?: string; vatId?: string; bankName?: string; iban?: string; bic?: string; logoDataUrl?: string;
}

interface DocumentModel {
  number: string; invoiceDate: string; serviceLabel: string; dueDate: string; currency: string;
  company: Party; customer: Party; introduction?: string; closing?: string;
  items: Array<{ position: number; description: string; quantity: string; unit: string; unitPrice: string; discount: string; tax: string; net: string }>;
  net: string; tax: string; gross: string;
}

const BLUE = '3157D5';
const INK = '182033';
const MUTED = '667085';
const LIGHT = 'F1F4FA';

@Injectable()
export class DocumentRenderService {
  model(invoice: Invoice): DocumentModel {
    const company = invoice.companySnapshot as unknown as Party;
    const customer = invoice.customerSnapshot as unknown as Party;
    const format = (minor: string) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: invoice.currency }).format(Number(BigInt(minor)) / 100);
    return {
      number: invoice.invoiceNumber,
      invoiceDate: this.date(invoice.invoiceDate),
      serviceLabel: invoice.serviceEnd ? `${this.date(invoice.serviceStart)} – ${this.date(invoice.serviceEnd)}` : this.date(invoice.serviceStart),
      dueDate: this.date(invoice.dueDate),
      currency: invoice.currency,
      company,
      customer,
      introduction: invoice.introductionText ?? undefined,
      closing: invoice.closingText ?? undefined,
      items: invoice.items.map((item) => ({
        position: item.position, description: item.description, quantity: this.decimal(item.quantity), unit: item.unit,
        unitPrice: format(item.unitPriceMinor), discount: item.discountBasisPoints ? `${this.rate(item.discountBasisPoints)} %` : '–',
        tax: `${this.rate(item.taxRateBasisPoints)} %`, net: format(item.netMinor),
      })),
      net: format(invoice.netMinor), tax: format(invoice.taxMinor), gross: format(invoice.grossMinor),
    };
  }

  async pdf(invoice: Invoice): Promise<Buffer> {
    const model = this.model(invoice);
    const doc = new PDFDocument({ size: 'A4', margins: { top: 48, right: 48, bottom: 58, left: 48 }, bufferPages: true, info: { Title: `Rechnung ${model.number}`, Author: model.company.name } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const complete = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
    const logo = this.logo(model.company.logoDataUrl);
    if (logo) { try { doc.image(logo.data, 48, 44, { fit: [120, 54] }); } catch { /* invalid image is ignored */ } }
    doc.fillColor(`#${INK}`).font('Helvetica-Bold').fontSize(24).text('RECHNUNG', 350, 52, { width: 197, align: 'right' });
    doc.fillColor(`#${BLUE}`).fontSize(11).text(model.number, 350, 83, { width: 197, align: 'right' });
    doc.fillColor(`#${MUTED}`).font('Helvetica').fontSize(7).text(`${model.company.name} · ${model.company.street} · ${model.company.postalCode} ${model.company.city}`, 48, 127);
    doc.fillColor(`#${INK}`).fontSize(10).text(this.partyLines(model.customer).join('\n'), 48, 142, { lineGap: 2 });
    doc.font('Helvetica-Bold').text('Rechnungsdatum', 350, 139).font('Helvetica').text(model.invoiceDate, 462, 139, { align: 'right', width: 85 });
    doc.font('Helvetica-Bold').text('Leistung', 350, 157).font('Helvetica').text(model.serviceLabel, 442, 157, { align: 'right', width: 105 });
    doc.font('Helvetica-Bold').text('Zahlbar bis', 350, 175).font('Helvetica').text(model.dueDate, 462, 175, { align: 'right', width: 85 });
    let y = 236;
    if (model.introduction) { doc.font('Helvetica').fontSize(10).fillColor(`#${INK}`).text(model.introduction, 48, y, { width: 499, lineGap: 2 }); y = doc.y + 22; }
    const tableHeader = () => {
      doc.rect(48, y, 499, 25).fill(`#${BLUE}`);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(8);
      const headers = [['Pos.', 52, 30], ['Beschreibung', 82, 210], ['Menge', 292, 62], ['Steuer', 354, 52], ['Netto', 406, 137]] as const;
      for (const [label, x, width] of headers) doc.text(label, x, y + 8, { width, align: label === 'Netto' ? 'right' : 'left' });
      y += 25;
    };
    tableHeader();
    for (const item of model.items) {
      const height = Math.max(32, doc.heightOfString(item.description, { width: 200 }) + 16);
      if (y + height > 725) { doc.addPage(); y = 52; tableHeader(); }
      if (item.position % 2 === 0) doc.rect(48, y, 499, height).fill(`#${LIGHT}`);
      doc.fillColor(`#${INK}`).font('Helvetica').fontSize(8);
      doc.text(String(item.position), 52, y + 9, { width: 26 });
      doc.text(item.description, 82, y + 9, { width: 200 });
      doc.text(`${item.quantity} ${item.unit}\n${item.unitPrice}`, 292, y + 9, { width: 60 });
      doc.text(item.tax, 354, y + 9, { width: 50 });
      doc.text(item.net, 406, y + 9, { width: 137, align: 'right' });
      y += height;
    }
    if (y > 650) { doc.addPage(); y = 70; }
    y += 18;
    this.pdfTotal(doc, 'Nettobetrag', model.net, y, false); y += 21;
    this.pdfTotal(doc, 'Umsatzsteuer', model.tax, y, false); y += 23;
    this.pdfTotal(doc, 'Gesamtbetrag', model.gross, y, true); y += 42;
    if (model.closing) doc.fillColor(`#${INK}`).font('Helvetica').fontSize(10).text(model.closing, 48, y, { width: 499 });
    const pages = doc.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      doc.switchToPage(index);
      const footer = [model.company.name, [model.company.taxId && `St.-Nr. ${model.company.taxId}`, model.company.vatId && `USt-IdNr. ${model.company.vatId}`].filter(Boolean).join(' · '), [model.company.bankName, model.company.iban && `IBAN ${model.company.iban}`, model.company.bic && `BIC ${model.company.bic}`].filter(Boolean).join(' · ')].filter(Boolean).join('   |   ');
      doc.moveTo(48, 790).lineTo(547, 790).strokeColor('#D8DEEA').stroke();
      doc.fillColor(`#${MUTED}`).font('Helvetica').fontSize(7).text(footer, 48, 799, { width: 430, lineBreak: false });
      doc.text(`Seite ${index + 1}/${pages.count}`, 480, 799, { width: 67, align: 'right' });
    }
    doc.end();
    return complete;
  }

  async docx(invoice: Invoice): Promise<Buffer> {
    const model = this.model(invoice);
    const logo = this.logo(model.company.logoDataUrl);
    const headerChildren: Paragraph[] = [];
    if (logo) {
      headerChildren.push(new Paragraph({ children: [new ImageRun({ data: logo.data, transformation: { width: 120, height: 48 }, type: logo.type })] }));
    }
    const children: Array<Paragraph | Table> = [
      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 100 }, children: [new TextRun({ text: 'RECHNUNG', bold: true, size: 44, color: INK })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 420 }, children: [new TextRun({ text: model.number, bold: true, size: 22, color: BLUE })] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `${model.company.name} · ${model.company.street} · ${model.company.postalCode} ${model.company.city}`, size: 14, color: MUTED })] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: this.noBorders(), rows: [new TableRow({ children: [
        new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: this.partyLines(model.customer).map((line, index) => new Paragraph({ children: [new TextRun({ text: line, bold: index === 0, size: 20, color: INK })] })) }),
        new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [
          this.keyValue('Rechnungsdatum', model.invoiceDate), this.keyValue('Leistung', model.serviceLabel), this.keyValue('Zahlbar bis', model.dueDate),
        ] }),
      ] })] }),
      new Paragraph({ spacing: { before: 420, after: 280 }, children: [new TextRun({ text: model.introduction ?? '', size: 20, color: INK })] }),
      this.docxItems(model),
      new Paragraph({ spacing: { before: 280 } }),
      this.docxTotals(model),
      new Paragraph({ spacing: { before: 360 }, children: [new TextRun({ text: model.closing ?? '', size: 20, color: INK })] }),
    ];
    const footerText = [model.company.name, model.company.taxId && `St.-Nr. ${model.company.taxId}`, model.company.vatId && `USt-IdNr. ${model.company.vatId}`, model.company.bankName, model.company.iban && `IBAN ${model.company.iban}`, model.company.bic && `BIC ${model.company.bic}`].filter(Boolean).join(' · ');
    const document = new Document({ sections: [{
      properties: { page: { margin: { top: 700, right: 700, bottom: 850, left: 700 } } },
      headers: headerChildren.length ? { default: new Header({ children: headerChildren }) } : undefined,
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: footerText, size: 14, color: MUTED })] })] }) },
      children,
    }] });
    return Packer.toBuffer(document);
  }

  private docxItems(model: DocumentModel): Table {
    const header = new TableRow({ tableHeader: true, children: ['Pos.', 'Beschreibung', 'Menge', 'Steuer', 'Netto'].map((text) => new TableCell({ shading: { type: ShadingType.CLEAR, fill: BLUE, color: 'auto' }, children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 16 })] })] })) });
    const rows = model.items.map((item) => new TableRow({ cantSplit: true, children: [String(item.position), item.description, `${item.quantity} ${item.unit}\n${item.unitPrice}`, item.tax, item.net].map((text, index) => new TableCell({ shading: item.position % 2 === 0 ? { type: ShadingType.CLEAR, fill: LIGHT, color: 'auto' } : undefined, children: text.split('\n').map((line) => new Paragraph({ alignment: index === 4 ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: line, size: 16, color: INK })] })) })) }));
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [700, 4300, 1500, 1000, 1700], rows: [header, ...rows] });
  }

  private docxTotals(model: DocumentModel): Table {
    return new Table({ alignment: AlignmentType.RIGHT, width: { size: 44, type: WidthType.PERCENTAGE }, borders: this.noBorders(), rows: [
      this.totalRow('Nettobetrag', model.net, false), this.totalRow('Umsatzsteuer', model.tax, false), this.totalRow('Gesamtbetrag', model.gross, true),
    ] });
  }

  private totalRow(label: string, value: string, emphasis: boolean): TableRow {
    return new TableRow({ children: [label, value].map((text, index) => new TableCell({ shading: emphasis ? { type: ShadingType.CLEAR, fill: BLUE, color: 'auto' } : undefined, children: [new Paragraph({ alignment: index ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text, bold: emphasis, color: emphasis ? 'FFFFFF' : INK, size: emphasis ? 22 : 18 })] })] })) });
  }

  private keyValue(key: string, value: string): Paragraph { return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: `${key}: `, bold: true, size: 18 }), new TextRun({ text: value, size: 18 })] }); }
  private noBorders() { return { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }; }
  private pdfTotal(doc: PDFKit.PDFDocument, label: string, value: string, y: number, emphasis: boolean): void { if (emphasis) doc.rect(342, y - 6, 205, 28).fill(`#${BLUE}`); doc.fillColor(emphasis ? 'white' : `#${INK}`).font(emphasis ? 'Helvetica-Bold' : 'Helvetica').fontSize(emphasis ? 11 : 9).text(label, 354, y, { width: 95 }).text(value, 449, y, { width: 86, align: 'right' }); }
  private partyLines(party: Party): string[] { return [party.name, party.contactName, party.street, `${party.postalCode} ${party.city}`, party.country !== 'DE' ? party.country : undefined].filter((value): value is string => Boolean(value)); }
  private date(value: string): string { return new Intl.DateTimeFormat('de-DE').format(new Date(`${value}T12:00:00Z`)); }
  private decimal(value: string): string { return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 4 }).format(Number(value)); }
  private rate(value: number): string { return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(value / 100); }
  private logo(value?: string): { data: Buffer; type: 'png' | 'jpg' } | null { const match = value?.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/); if (!match || !match[1] || !match[2]) return null; return { data: Buffer.from(match[2], 'base64'), type: match[1] === 'jpeg' ? 'jpg' : 'png' }; }
}
