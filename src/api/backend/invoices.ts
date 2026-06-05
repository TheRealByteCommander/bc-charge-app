import { apiConfig } from '../../config/api';

export async function downloadInvoicePdf(sessionId: string, invoiceNumber: string): Promise<void> {
  const url = `${apiConfig.baseUrl}/api/invoices/${encodeURIComponent(sessionId)}/pdf`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Rechnung konnte nicht geladen werden.');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${invoiceNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
