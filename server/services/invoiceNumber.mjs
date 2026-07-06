import { allocateInvoiceNumber, findInvoiceNumberBySessionId } from '../db.mjs';

/** @deprecated Nur Anzeige-Fallback für alte Sitzungen ohne gespeicherte Nummer. */
export function invoiceNumberFromSessionId(sessionId) {
  const n = sessionId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const year = new Date().getFullYear();
  return `BC-${year}-L${String(100000 + (n % 900000)).slice(0, 6)}`;
}

export async function ensureInvoiceNumber(userId, session) {
  if (session.invoiceNumber) return session.invoiceNumber;
  const registered = await findInvoiceNumberBySessionId(session.id);
  if (registered) return registered;
  return allocateInvoiceNumber(userId, session.id);
}
