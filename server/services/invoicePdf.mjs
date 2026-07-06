import PDFDocument from 'pdfkit';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { companyInfo } from './company.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = resolve(__dirname, '../assets/invoice-logo.png');

const VAT_RATE = 0.19;
const BRAND = {
  dark: '#1a2332',
  accent: '#10b981',
  accentLight: '#34d399',
  muted: '#6b7280',
  border: '#e5e7eb',
  text: '#111827',
};

function eur(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', {
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

function loadLogo() {
  try {
    return readFileSync(LOGO_PATH);
  } catch {
    return null;
  }
}

function drawHeader(doc) {
  const headerH = 88;
  doc.save();
  doc.rect(0, 0, doc.page.width, headerH).fill(BRAND.dark);

  const logo = loadLogo();
  if (logo) {
    doc.image(logo, 50, 18, { width: 52, height: 52 });
  }

  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22);
  doc.text('BC', 115, 26, { continued: true });
  doc.fillColor(BRAND.accentLight).text(' Charge', { continued: false });

  doc.fillColor('#cbd5e1').font('Helvetica').fontSize(9);
  doc.text('Öffentliche Ladepunkte · Byte Commander GmbH', 115, 54);

  doc.restore();
  doc.y = headerH + 28;
}

function labelValue(doc, label, value, x, y, width) {
  doc.fillColor(BRAND.muted).font('Helvetica').fontSize(8).text(label.toUpperCase(), x, y, { width });
  doc.fillColor(BRAND.text).font('Helvetica').fontSize(10).text(value, x, y + 11, { width });
}

function drawPartyBlock(doc, title, lines, x, y, width) {
  doc.fillColor(BRAND.accent).font('Helvetica-Bold').fontSize(8).text(title.toUpperCase(), x, y);
  let cy = y + 14;
  doc.fillColor(BRAND.text).font('Helvetica').fontSize(10);
  for (const line of lines) {
    if (!line) continue;
    doc.text(line, x, cy, { width });
    cy += 14;
  }
  return cy;
}

function paymentStatusLabel(status) {
  if (status === 'paid') return 'Bezahlt (Kartenzahlung)';
  if (status === 'failed') return 'Zahlung fehlgeschlagen';
  if (status === 'pending') return 'Ausstehend';
  return 'Offen';
}

export function buildInvoicePdf({ invoiceNumber, session, customer }) {
  const grossTotal = Math.round((session.costEur ?? 0) * 100) / 100;
  const amounts = computeInvoiceAmounts(grossTotal);
  const invoiceDate = session.endedAt ?? new Date().toISOString();
  const minutes =
    session.endedAt && session.startedAt
      ? (new Date(session.endedAt) - new Date(session.startedAt)) / 60000
      : 0;
  const energyNet = session.energyKwh * (session.pricePerKwh ?? 0);
  const timeCost = minutes * (session.pricePerMin ?? 0);
  const sessionFee = session.sessionFee ?? 0;
  const discount = session.rewardDiscountEur ?? 0;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc);

    // Rechnungsmeta rechts
    const metaX = 340;
    labelValue(doc, 'Rechnung', invoiceNumber, metaX, 116, 205);
    labelValue(doc, 'Rechnungsdatum', formatDate(invoiceDate), metaX, 152, 205);
    labelValue(doc, 'Leistungszeitraum', `${formatDateTime(session.startedAt)} – ${formatDateTime(session.endedAt)}`, metaX, 188, 205);
    labelValue(doc, 'Kundennummer', customer.membershipId ?? '–', metaX, 224, 205);

    doc.y = 116;
    drawPartyBlock(
      doc,
      'Rechnungssteller',
      [
        companyInfo.legalName,
        companyInfo.street,
        `${companyInfo.zip} ${companyInfo.city}`,
        companyInfo.country,
        `Tel. ${companyInfo.phone}`,
        companyInfo.email,
        `USt-IdNr.: ${companyInfo.vatId}`,
        ...(companyInfo.taxNumber ? [`Steuernr.: ${companyInfo.taxNumber}`] : []),
        `GF: ${companyInfo.managingDirector}`,
        `${companyInfo.registerCourt}, ${companyInfo.registerNumber}`,
        companyInfo.websiteDisplay,
      ],
      50,
      116,
      260
    );

    const recipientY = 300;
    drawPartyBlock(
      doc,
      'Rechnungsempfänger',
      [
        `${customer.firstName} ${customer.lastName}`,
        customer.email,
        customer.phone ? `Tel. ${customer.phone}` : null,
      ],
      50,
      recipientY,
      480
    );

    doc.y = recipientY + 70;
    doc.fillColor(BRAND.text).font('Helvetica-Bold').fontSize(12).text('Leistungsübersicht');
    doc.moveDown(0.4);
    doc.fillColor(BRAND.muted).font('Helvetica').fontSize(9);
    doc.text(
      `Ladevorgang an ${session.stationName} · ${session.connectorType} · ${session.powerKw} kW` +
        (session.evseNumber != null ? ` · Ladepunkt ${session.evseNumber}` : '')
    );
    doc.text(`Energie: ${session.energyKwh.toFixed(2)} kWh`);
    if (session.id) doc.text(`Vorgangsreferenz: ${session.id}`);
    if (session.stripePaymentIntentId) doc.text(`Zahlungsreferenz: ${session.stripePaymentIntentId}`);
    doc.moveDown(1);

    const col = { pos: 50, qty: 250, unit: 320, total: 470 };
    const tableTop = doc.y;
    doc.rect(50, tableTop, 495, 22).fill('#f3f4f6');
    doc.fillColor(BRAND.muted).font('Helvetica-Bold').fontSize(8);
    doc.text('POSITION', col.pos + 8, tableTop + 7);
    doc.text('MENGE', col.qty, tableTop + 7);
    doc.text('EINZELPREIS', col.unit, tableTop + 7);
    doc.text('BETRAG', col.total, tableTop + 7, { width: 70, align: 'right' });

    const rows = [];
    if (session.energyKwh > 0) {
      rows.push({
        label: 'Stromlieferung (öffentliches Laden)',
        qty: `${session.energyKwh.toFixed(2)} kWh`,
        unit: eur(session.pricePerKwh ?? 0),
        total: eur(energyNet),
      });
    }
    if (sessionFee > 0) {
      rows.push({
        label: 'Startgebühr',
        qty: '1',
        unit: eur(sessionFee),
        total: eur(sessionFee),
      });
    }
    if (timeCost > 0) {
      rows.push({
        label: 'Zeitgebühr',
        qty: `${minutes.toFixed(0)} Min.`,
        unit: eur(session.pricePerMin ?? 0),
        total: eur(timeCost),
      });
    }
    if (discount > 0) {
      rows.push({
        label: session.rewardLabel ? `Prämienrabatt (${session.rewardLabel})` : 'Prämienrabatt',
        qty: '1',
        unit: eur(-discount),
        total: eur(-discount),
      });
    }
    if (rows.length === 0) {
      rows.push({
        label: 'Ladeleistung',
        qty: `${session.energyKwh.toFixed(2)} kWh`,
        unit: '—',
        total: eur(grossTotal),
      });
    }

    let rowY = tableTop + 28;
    doc.font('Helvetica').fontSize(9).fillColor(BRAND.text);
    for (const row of rows) {
      doc.text(row.label, col.pos + 8, rowY, { width: 190 });
      doc.text(row.qty, col.qty, rowY);
      doc.text(row.unit, col.unit, rowY);
      doc.text(row.total, col.total, rowY, { width: 70, align: 'right' });
      rowY += 22;
      doc.moveTo(50, rowY - 6).lineTo(545, rowY - 6).strokeColor(BRAND.border).stroke();
    }

    const totalsY = rowY + 16;
    const totalsX = 330;
    doc.font('Helvetica').fontSize(10).fillColor(BRAND.text);
    doc.text(`Nettobetrag`, totalsX, totalsY);
    doc.text(eur(amounts.net), 470, totalsY, { width: 75, align: 'right' });
    doc.text(`Umsatzsteuer ${Math.round(VAT_RATE * 100)} %`, totalsX, totalsY + 18);
    doc.text(eur(amounts.vat), 470, totalsY + 18, { width: 75, align: 'right' });

    doc.rect(totalsX - 10, totalsY + 38, 225, 30).fill('#ecfdf5');
    doc.fillColor(BRAND.accent).font('Helvetica-Bold').fontSize(12);
    doc.text('Gesamtbetrag', totalsX, totalsY + 46);
    doc.text(eur(amounts.gross), 470, totalsY + 46, { width: 75, align: 'right' });

    const footY = totalsY + 90;
    doc.fillColor(BRAND.muted).font('Helvetica').fontSize(8);
    doc.text(
      'Steuerlicher Hinweis: Es wird die gesetzliche Umsatzsteuer von 19 % auf den Gesamtbetrag ausgewiesen (§14 UStG).',
      50,
      footY,
      { width: 495 }
    );
    doc.moveDown(0.6);
    doc.text(`Zahlungsstatus: ${paymentStatusLabel(session.paymentStatus)}`, { width: 495 });
    if (session.paymentStatus === 'paid') {
      doc.text('Der Rechnungsbetrag wurde bereits per Kartenzahlung (Stripe) beglichen.', { width: 495 });
    }
    doc.moveDown(0.4);
    doc.text(
      `Bei Rückfragen: ${companyInfo.email} · ${companyInfo.phone} · ${companyInfo.websiteDisplay}`,
      { width: 495 }
    );
    doc.text(
      'Verbraucherstreitbeilegung: Wir sind nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
      { width: 495 }
    );

    doc.end();
  });
}
