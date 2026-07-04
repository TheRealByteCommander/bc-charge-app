import { citrineosConfig } from '../../config/citrineos';
import type { Station } from '../../types';
import { citrineosFetch } from './client';
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

function normalizeStartConfirmations(result: unknown): CitrineosMessageConfirmation[] {
  if (Array.isArray(result)) {
    return result as CitrineosMessageConfirmation[];
  }
  if (result && typeof result === 'object') {
    const row = result as Record<string, unknown>;
    if (typeof row.success === 'boolean') {
      return [{ success: row.success, payload: row.payload as string | Record<string, unknown> | undefined }];
    }
    const status = String(row.status ?? row.Status ?? '');
    if (status) {
      return [{ success: status.toLowerCase() === 'accepted', payload: status }];
    }
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
  body: { connectorId: number; idTag: string }
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
  const ocppVersion = station.hardwareFeatures?.ocppVersion ?? '2.0.1';
  if (ocppVersion === '1.6') {
    try {
      return await requestStartTransactionOcpp16(station.id, {
        connectorId: ref.connectorId,
        idTag: idToken,
      });
    } catch (e) {
      // Fallback: manche CitrineOS-Installationen exposen nur 2.0.1-Bridge
      console.warn('[BC Charge] OCPP-1.6-Start fehlgeschlagen, versuche 2.0.1:', e);
    }
  }
  return requestStartTransaction(station.id, {
    evseId: ref.evseId,
    remoteStartId,
    idToken: { idToken, type: citrineosConfig.idTokenType },
  });
}

/**
 * OCPP 2.0.1 RequestStopTransaction (Modul evdriver).
 */
export async function requestStopTransaction(
  stationId: string,
  body: CitrineosRequestStopTransactionBody
): Promise<CitrineosMessageConfirmation[]> {
  return citrineosFetch<CitrineosMessageConfirmation[]>(citrineosPaths.evdriver.requestStopTransaction, {
    method: 'POST',
    query: messageQuery(stationId),
    body,
    timeoutMs: 15_000,
  });
}
