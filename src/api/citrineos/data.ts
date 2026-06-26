import { apiConfig } from '../../config/api';
import { citrineosConfig } from '../../config/citrineos';
import { isBackendMode } from '../../services/backendMode';
import { citrineosFetch } from './client';
import { citrineosPaths } from './paths';
import type { CitrineosTariff, CitrineosTransaction } from './types';

/** Aktive/abgeschlossene Transaktion aus der Data-API (Modul transactions). */
export async function getTransaction(
  stationId: string,
  transactionId: string
): Promise<CitrineosTransaction | undefined> {
  const result = await citrineosFetch<CitrineosTransaction | null>(citrineosPaths.transactions.getTransaction, {
    method: 'GET',
    query: {
      tenantId: citrineosConfig.tenantId,
      stationId,
      transactionId,
    },
  });
  return result ?? undefined;
}

/** Tarife für Preisanzeige (Modul transactions). */
export async function getTariffs(): Promise<CitrineosTariff[]> {
  if (isBackendMode()) {
    const res = await fetch(`${apiConfig.baseUrl}/api/citrineos/tariffs`, { credentials: 'include' });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Tarife ${res.status}`);
    }
    return (await res.json()) as CitrineosTariff[];
  }
  return citrineosFetch<CitrineosTariff[]>(citrineosPaths.transactions.getTariffs, {
    method: 'GET',
    query: { tenantId: citrineosConfig.tenantId },
  });
}
