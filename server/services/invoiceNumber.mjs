/** Stabile Rechnungsnummer aus Sitzungs-ID (gleiche Logik wie Frontend). */
export function invoiceNumberFromSessionId(sessionId) {
  const n = sessionId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return `BC-2026-${String(100000 + (n % 900000)).slice(0, 6)}`;
}
