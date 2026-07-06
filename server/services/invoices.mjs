import { findUserById, rowToProfile, upsertSession } from '../db.mjs';
import { ensureInvoiceNumber } from './invoiceNumber.mjs';
import { buildInvoicePdf } from './invoicePdf.mjs';
import { sendInvoiceEmails } from './invoiceEmail.mjs';

export async function buildInvoiceForSession(userId, session, customer) {
  const invoiceNumber = await ensureInvoiceNumber(userId, session);
  const pdfBuffer = await buildInvoicePdf({ invoiceNumber, session, customer });
  return { invoiceNumber, pdfBuffer };
}

export async function issueInvoiceForSession(userId, session) {
  if (session.status !== 'completed') {
    return { ok: false, error: 'Nur abgeschlossene Sitzungen können abgerechnet werden.' };
  }

  const row = await findUserById(userId);
  if (!row) return { ok: false, error: 'Nutzer nicht gefunden.' };

  const profile = rowToProfile(row);
  const customer = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    membershipId: profile.membershipId,
  };

  const invoiceNumber = await ensureInvoiceNumber(userId, session);
  const sessionWithInvoice = { ...session, invoiceNumber };
  const { pdfBuffer } = await buildInvoiceForSession(userId, sessionWithInvoice, customer);

  let emailResult = { sent: false };
  if (!session.invoiceEmailedAt) {
    emailResult = await sendInvoiceEmails({
      invoiceNumber,
      session: sessionWithInvoice,
      customer,
      pdfBuffer,
    });
  }

  const updatedSession = {
    ...sessionWithInvoice,
    invoiceEmailedAt: emailResult.sent
      ? new Date().toISOString()
      : session.invoiceEmailedAt ?? null,
  };
  await upsertSession(userId, updatedSession);

  return {
    ok: true,
    session: updatedSession,
    invoiceNumber,
    emailSent: emailResult.sent,
    emailSkipped: Boolean(session.invoiceEmailedAt),
    pdfBuffer,
  };
}
