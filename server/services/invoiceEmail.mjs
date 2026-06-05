import nodemailer from 'nodemailer';
import { companyInfo } from './company.mjs';

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export function isEmailConfigured() {
  return Boolean(getTransporter());
}

export async function sendInvoiceEmails({ invoiceNumber, session, customer, pdfBuffer }) {
  const transport = getTransporter();
  if (!transport) {
    console.warn('[bc-charge] SMTP nicht konfiguriert – Rechnungs-E-Mails übersprungen.');
    return { sent: false, reason: 'smtp_not_configured' };
  }

  const from = process.env.SMTP_FROM ?? `BC Charge <${companyInfo.email}>`;
  const copyTo = companyInfo.email;
  const customerEmail = customer.email;
  const station = session.stationName;
  const gross = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
    session.costEur
  );

  const subject = `BC Charge Rechnung ${invoiceNumber}`;
  const text = [
    `Guten Tag ${customer.firstName} ${customer.lastName},`,
    '',
    `anbei erhalten Sie Ihre Rechnung ${invoiceNumber} für den Ladevorgang an`,
    `${station} (${gross}).`,
    '',
    'Mit freundlichen Grüßen',
    `${companyInfo.brand} · ${companyInfo.legalName}`,
  ].join('\n');

  const attachment = {
    filename: `${invoiceNumber}.pdf`,
    content: pdfBuffer,
    contentType: 'application/pdf',
  };

  const recipients = new Set([customerEmail, copyTo].filter(Boolean));

  for (const to of recipients) {
    await transport.sendMail({
      from,
      to,
      subject,
      text,
      attachments: [attachment],
    });
    console.log(`[bc-charge] Rechnung ${invoiceNumber} an ${to} gesendet.`);
  }

  return { sent: true, recipients: [...recipients] };
}
