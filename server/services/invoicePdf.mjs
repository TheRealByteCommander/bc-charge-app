import PDFDocument from 'pdfkit';
import { companyInfo } from './company.mjs';

const VAT_RATE = 0.19;

function eur(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatDt(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function computeInvoiceAmounts(grossEur) {
  const gross = Math.round(grossEur * 100) / 100;
  const net = Math.round((gross / (1 + VAT_RATE)) * 100) / 100;
  const vat = Math.round((gross - net) * 100) / 100;
  return { gross, net, vat, vatRate: VAT_RATE };
}

export function buildInvoicePdf({ invoiceNumber, session, customer }) {
  const amounts = computeInvoiceAmounts(session.costEur);
  const energyCost = Math.max(0, session.costEur - (session.sessionFee ?? 0));
  const invoiceDate = session.endedAt ?? new Date().toISOString();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text('Rechnung', { align: 'right' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').text(invoiceNumber, { align: 'right' });
    doc.text(`Datum: ${formatDt(invoiceDate)}`, { align: 'right' });
    doc.moveDown(2);

    doc.fontSize(10).font('Helvetica-Bold').text('Rechnungssteller');
    doc.font('Helvetica');
    doc.text(companyInfo.legalName);
    doc.text(`${companyInfo.street}, ${companyInfo.zip} ${companyInfo.city}`);
    doc.text(companyInfo.country);
    doc.text(`Tel. ${companyInfo.phone}`);
    doc.text(companyInfo.email);
    doc.text(`GF: ${companyInfo.managingDirector}`);
    doc.text(`${companyInfo.registerCourt}, ${companyInfo.registerNumber}`);
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').text('Rechnungsempfänger');
    doc.font('Helvetica');
    doc.text(`${customer.firstName} ${customer.lastName}`);
    doc.text(customer.email);
    if (customer.phone) doc.text(customer.phone);
    doc.text(`Kundennummer: ${customer.membershipId}`);
    doc.moveDown(2);

    doc.font('Helvetica-Bold').text('Ladevorgang', { underline: true });
    doc.moveDown(0.5);
    doc.font('Helvetica');
    doc.text(`Station: ${session.stationName}`);
    doc.text(`Anschluss: ${session.connectorType} · ${session.powerKw} kW`);
    doc.text(`Beginn: ${formatDt(session.startedAt)}`);
    doc.text(`Ende: ${formatDt(session.endedAt)}`);
    doc.text(`Energie: ${session.energyKwh.toFixed(2)} kWh`);
    if (session.stripePaymentIntentId) {
      doc.text(`Zahlungsreferenz: ${session.stripePaymentIntentId}`);
    }
    doc.moveDown(1.5);

    const tableTop = doc.y;
    doc.font('Helvetica-Bold');
    doc.text('Position', 50, tableTop);
    doc.text('Menge', 280, tableTop);
    doc.text('Einzelpreis', 350, tableTop);
    doc.text('Betrag', 470, tableTop, { width: 80, align: 'right' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    doc.font('Helvetica');
    const row1 = doc.y;
    doc.text('Ladeenergie', 50, row1);
    doc.text(`${session.energyKwh.toFixed(2)} kWh`, 280, row1);
    doc.text(eur(session.pricePerKwh), 350, row1);
    doc.text(eur(energyCost), 470, row1, { width: 80, align: 'right' });
    doc.moveDown(0.8);

    if ((session.sessionFee ?? 0) > 0) {
      const row2 = doc.y;
      doc.text('Startgebühr', 50, row2);
      doc.text('1', 280, row2);
      doc.text(eur(session.sessionFee), 350, row2);
      doc.text(eur(session.sessionFee), 470, row2, { width: 80, align: 'right' });
      doc.moveDown(0.8);
    }

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    doc.text(`Nettobetrag: ${eur(amounts.net)}`, { align: 'right' });
    doc.text(`USt. ${Math.round(VAT_RATE * 100)} %: ${eur(amounts.vat)}`, { align: 'right' });
    doc.font('Helvetica-Bold').text(`Gesamtbetrag: ${eur(amounts.gross)}`, { align: 'right' });
    doc.moveDown(2);

    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    doc.text(companyInfo.vatIdNote);
    doc.text(
      'Zahlungsstatus: ' +
        (session.paymentStatus === 'paid'
          ? 'Bezahlt'
          : session.paymentStatus === 'failed'
            ? 'Zahlung fehlgeschlagen'
            : session.paymentStatus === 'pending'
              ? 'Ausstehend'
              : 'Offen')
    );
    doc.text(`BC Points für diese Ladung: ${session.pointsEarned ?? 0}`);
    doc.fillColor('#000000');

    doc.end();
  });
}
