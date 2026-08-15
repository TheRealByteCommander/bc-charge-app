import { apiConfig } from '../../config/api';
import { errorMessageFromPayload, readResponseJson } from '../parse';

export async function downloadInvoicePdf(sessionId: string, invoiceNumber: string): Promise<void> {
  const url = `${apiConfig.baseUrl}/api/invoices/${encodeURIComponent(sessionId)}/pdf`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    // PDF error bodies are JSON; never cast res.json() — shared parse edge.
    let data: unknown = undefined;
    try {
      data = await readResponseJson(res);
    } catch {
      data = undefined;
    }
    throw new Error(errorMessageFromPayload(data, 'Rechnung konnte nicht geladen werden.'));
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${invoiceNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
