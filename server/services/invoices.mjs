import { findUserById, rowToProfile, upsertSession, allocateInvoiceNumber, findInvoiceNumberBySessionId } from '../db.mjs';
import { ensureInvoiceNumber } from './invoiceNumber.mjs';
import { buildInvoicePdf } from './invoicePdf.mjs';
import { sendInvoiceEmails } from './invoiceEmail.mjs';

export async function buildInvoiceForSession(userId, session, customer, { registrySessionId } = {}) {
  const invoiceNumber = registrySessionId
    ? (session.invoiceNumber ??
        (await findInvoiceNumberBySessionId(registrySessionId)) ??
        (await allocateInvoiceNumber(userId, registrySessionId)))
    : await ensureInvoiceNumber(userId, session);
  const pdfBuffer = await buildInvoicePdf({ invoiceNumber, session: { ...session, invoiceNumber } });
  return { invoiceNumber, pdfBuffer };
}

/**
 * @param {string} userId
 * @param {object} session
 * @param {{ registrySessionId?: string, skipSessionUpsert?: boolean }} [opts]
 *   registrySessionId — use batch id as invoice_registry.session_id for Sammelrechnungen
 *   skipSessionUpsert — caller persists member sessions itself
 */
export async function issueInvoiceForSession(userId, session, opts = {}) {
  const { registrySessionId, skipSessionUpsert = false } = opts;

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

  let invoiceNumber = session.invoiceNumber;
  if (!invoiceNumber) {
    if (registrySessionId) {
      invoiceNumber =
        (await findInvoiceNumberBySessionId(registrySessionId)) ??
        (await allocateInvoiceNumber(userId, registrySessionId));
    } else {
      invoiceNumber = await ensureInvoiceNumber(userId, session);
    }
  }

  const sessionWithInvoice = { ...session, invoiceNumber };
  const pdfBuffer = await buildInvoicePdf({ invoiceNumber, session: sessionWithInvoice, customer });

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

  if (!skipSessionUpsert && updatedSession.id && updatedSession.id !== 'batch' && !String(updatedSession.id).startsWith('batch_')) {
    await upsertSession(userId, updatedSession);
  }

  return {
    ok: true,
    session: updatedSession,
    invoiceNumber,
    emailSent: emailResult.sent,
    emailSkipped: Boolean(session.invoiceEmailedAt),
    pdfBuffer,
  };
}
