import { citrineosConfig } from '../../config/citrineos';
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

/**
 * OCPP 2.0.1 RequestStartTransaction (Modul evdriver).
 * @see https://citrineos.github.io – Swagger unter {apiUrl}/docs
 */
export async function requestStartTransaction(
  stationId: string,
  body: CitrineosRequestStartTransactionBody
): Promise<CitrineosMessageConfirmation[]> {
  return citrineosFetch<CitrineosMessageConfirmation[]>(citrineosPaths.evdriver.requestStartTransaction, {
    method: 'POST',
    query: messageQuery(stationId),
    body,
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
  });
}
