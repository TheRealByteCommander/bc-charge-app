import { apiConfig } from '../../config/api';
import { citrineosConfig } from '../../config/citrineos';
import { isBackendMode } from '../../services/backendMode';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { citrineosFetch } from './client';
import {
  normalizeCitrineosTariffs,
  normalizeCitrineosTransaction,
} from './dto';
import { citrineosPaths } from './paths';
import type { CitrineosTariff, CitrineosTransaction } from './types';

/** Aktive/abgeschlossene Transaktion aus der Data-API (Modul transactions). */
export async function getTransaction(
  stationId: string,
  transactionId: string
): Promise<CitrineosTransaction | undefined> {
  const result = await citrineosFetch<unknown>(citrineosPaths.transactions.getTransaction, {
    method: 'GET',
    query: {
      tenantId: citrineosConfig.tenantId,
      stationId,
      transactionId,
    },
  });
  return normalizeCitrineosTransaction(result);
}

/** Tarife für Preisanzeige (Modul transactions). */
export async function getTariffs(): Promise<CitrineosTariff[]> {
  if (isBackendMode()) {
    const res = await fetchWithTimeout(`${apiConfig.baseUrl}/api/citrineos/tariffs`, { credentials: 'include' }, 10_000);
    if (!res.ok) {
      let errMsg = `Tarife ${res.status}`;
      try {
        const errBody: unknown = await res.json();
        if (
          errBody &&
          typeof errBody === 'object' &&
          !Array.isArray(errBody) &&
          typeof (errBody as { error?: unknown }).error === 'string'
        ) {
          errMsg = (errBody as { error: string }).error;
        }
      } catch {
        /* keep status message */
      }
      throw new Error(errMsg);
    }
    const body: unknown = await res.json();
    return normalizeCitrineosTariffs(body);
  }
  const raw = await citrineosFetch<unknown>(citrineosPaths.transactions.getTariffs, {
    method: 'GET',
    query: { tenantId: citrineosConfig.tenantId },
  });
  return normalizeCitrineosTariffs(raw);
}
