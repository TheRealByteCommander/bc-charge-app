import { z } from 'zod';
import { citrineosConfig } from '../../config/citrineos';
import type { Station } from '../../types';
import { buildOcpp16RemoteStartBody, normalizeIdToken } from '../../utils/ocpp16RemoteStart';
import { isPlainObject } from '../../utils/safeJson';
import { citrineosFetch } from './client';
import { parseConnectorRef } from './mappers';
import { citrineosPaths } from './paths';
import type {
  CitrineosMessageConfirmation,
  CitrineosRequestStartTransactionBody,
  CitrineosRequestStopTransactionBody,
} from './types';

/** Query-Parameter für alle CitrineOS Message-API-Aufrufe */
function messageQuery(stationId: string, callbackUrl?: string) {
  return {
    identifier: stationId,
    tenantId: citrineosConfig.tenantId,
    ...(callbackUrl ? { callbackUrl } : {}),
  };
}

/** Wire shape for OCPP/Citrine remote start|stop confirmations (array or single). */
const MessageConfirmationSchema = z
  .object({
    success: z.boolean().optional(),
    payload: z.union([z.string(), z.record(z.unknown())]).optional(),
    status: z.union([z.string(), z.number()]).optional(),
    Status: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

function confirmationFromRow(row: z.infer<typeof MessageConfirmationSchema>): CitrineosMessageConfirmation {
  if (typeof row.success === 'boolean') {
    return { success: row.success, payload: row.payload };
  }
  const status = String(row.status ?? row.Status ?? '');
  if (status) {
    return { success: status.toLowerCase() === 'accepted', payload: status };
  }
  return { success: false, payload: 'Unbekannte Antwort vom Ladesystem' };
}

/** Parse-don't-cast: fold array/single/status envelopes into domain confirmations. */
export function normalizeStartConfirmations(result: unknown): CitrineosMessageConfirmation[] {
  if (Array.isArray(result)) {
    const out: CitrineosMessageConfirmation[] = [];
    for (const item of result) {
      const parsed = MessageConfirmationSchema.safeParse(item);
      out.push(parsed.success ? confirmationFromRow(parsed.data) : { success: false, payload: 'Unbekannte Antwort vom Ladesystem' });
    }
    return out.length > 0 ? out : [{ success: false, payload: 'Unbekannte Antwort vom Ladesystem' }];
  }
  if (isPlainObject(result)) {
    const parsed = MessageConfirmationSchema.safeParse(result);
    if (parsed.success) return [confirmationFromRow(parsed.data)];
  }
  return [{ success: false, payload: 'Unbekannte Antwort vom Ladesystem' }];
}

/**
 * OCPP 2.0.1 RequestStartTransaction (Modul evdriver).
 * @see https://citrineos.github.io – Swagger unter {apiUrl}/docs
 */
export async function requestStartTransaction(
  stationId: string,
  body: CitrineosRequestStartTransactionBody
): Promise<CitrineosMessageConfirmation[]> {
  const result = await citrineosFetch<unknown>(citrineosPaths.evdriver.requestStartTransaction, {
    method: 'POST',
    query: messageQuery(stationId),
    body,
    timeoutMs: 15_000,
  });
  return normalizeStartConfirmations(result);
}

/** OCPP 1.6 RemoteStartTransaction (go-e, H2, …). */
export async function requestStartTransactionOcpp16(
  stationId: string,
  body: { connectorId: number; idTag: string; chargingProfile?: unknown }
): Promise<CitrineosMessageConfirmation[]> {
  const result = await citrineosFetch<unknown>(citrineosPaths.ocpp16.remoteStartTransaction, {
    method: 'POST',
    query: messageQuery(stationId),
    body,
    timeoutMs: 15_000,
  });
  return normalizeStartConfirmations(result);
}

export async function requestStartTransactionForStation(
  station: Station,
  ref: { evseId: number; connectorId: number },
  idToken: string,
  remoteStartId: number
): Promise<CitrineosMessageConfirmation[]> {
  const normalizedToken = normalizeIdToken(idToken);
  const ocppVersion = station.hardwareFeatures?.ocppVersion ?? '2.0.1';
  if (ocppVersion === '1.6') {
    try {
      const connector = station.connectors.find((c) => {
        const parsed = parseConnectorRef(c.id);
        return parsed?.evseId === ref.evseId && parsed?.connectorId === ref.connectorId;
      });
      return await requestStartTransactionOcpp16(
        station.id,
        buildOcpp16RemoteStartBody({
          connectorId: ref.connectorId,
          idTag: normalizedToken,
          vendor: station.chargePointVendor,
          powerKw: connector?.powerKw,
        })
      );
    } catch (e) {
      // Fallback: manche CitrineOS-Installationen exposen nur 2.0.1-Bridge
      console.warn('[BC Charge] OCPP-1.6-Start fehlgeschlagen, versuche 2.0.1:', e);
    }
  }
  return requestStartTransaction(station.id, {
    evseId: ref.evseId,
    remoteStartId,
    idToken: { idToken: normalizedToken, type: citrineosConfig.idTokenType },
  });
}

/**
 * OCPP 2.0.1 RequestStopTransaction (Modul evdriver).
 */
export async function requestStopTransaction(
  stationId: string,
  body: CitrineosRequestStopTransactionBody
): Promise<CitrineosMessageConfirmation[]> {
  const result = await citrineosFetch<unknown>(citrineosPaths.evdriver.requestStopTransaction, {
    method: 'POST',
    query: messageQuery(stationId),
    body,
    timeoutMs: 15_000,
  });
  return normalizeStartConfirmations(result);
}

/** OCPP 1.6 RemoteStopTransaction (go-e, H2, …). */
export async function requestStopTransactionOcpp16(
  stationId: string,
  transactionId: string | number
): Promise<CitrineosMessageConfirmation[]> {
  const result = await citrineosFetch<unknown>(citrineosPaths.ocpp16.remoteStopTransaction, {
    method: 'POST',
    query: messageQuery(stationId),
    body: { transactionId: Number(transactionId) || transactionId },
    timeoutMs: 15_000,
  });
  return normalizeStartConfirmations(result);
}

export async function requestStopTransactionForStation(
  station: Station,
  transactionId: string
): Promise<CitrineosMessageConfirmation[]> {
  const ocppVersion = station.hardwareFeatures?.ocppVersion ?? '2.0.1';
  const vendor = (station.chargePointVendor ?? '').toLowerCase();
  const useOcpp16 =
    ocppVersion === '1.6' ||
    vendor.includes('go-e') ||
    vendor.includes('goe') ||
    vendor.includes('elinta');

  if (useOcpp16) {
    try {
      return await requestStopTransactionOcpp16(station.id, transactionId);
    } catch (e) {
      console.warn('[BC Charge] OCPP-1.6-Stop fehlgeschlagen, versuche 2.0.1:', e);
    }
  }
  return requestStopTransaction(station.id, { transactionId });
}
