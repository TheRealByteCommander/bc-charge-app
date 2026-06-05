/** Stabile Rechnungsnummer aus Sitzungs-ID (gleiche Logik wie Server). */
export function invoiceNumberFromSessionId(sessionId: string): string {
  const n = sessionId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return `BC-2026-${String(100000 + (n % 900000)).slice(0, 6)}`;
}

export function displayInvoiceNumber(session: { id: string; invoiceNumber?: string }): string {
  return session.invoiceNumber ?? invoiceNumberFromSessionId(session.id);
}
