import { apiConfig } from '../../config/api';
import { citrineosConfig } from '../../config/citrineos';
import { isBackendMode } from '../../services/backendMode';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { citrineosFetch, CitrineosApiError } from './client';
import {
  normalizeCitrineosTariffs,
  normalizeCitrineosTransaction,
} from './dto';
import {
  resolveClientDataApiPaths,
  type CitrineosRestSurface,
} from './paths';
import type { CitrineosTariff, CitrineosTransaction } from './types';

const RETRYABLE_STATUSES = new Set([404, 405, 410, 501]);

/**
 * GET against dual-path candidates (legacy /data/** then /commands/* for #849).
 * First successful response wins; 404/405/410/501 try the next path.
 */
async function citrineosDualFetch<T>(
  pathCandidates: string[],
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    query?: Record<string, string | number | undefined>;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  let lastError: unknown;
  for (const path of pathCandidates) {
    try {
      return await citrineosFetch<T>(path, { ...options, method: options.method ?? 'GET' });
    } catch (e) {
      lastError = e;
      if (e instanceof CitrineosApiError && RETRYABLE_STATUSES.has(e.status)) {
        continue;
      }
      throw e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new CitrineosApiError('CitrineOS dual-fetch exhausted path candidates', 502);
}

function clientRestSurface(): CitrineosRestSurface {
  // Browser cannot read server env; default auto (legacy→commands). Backend-mode
  // tariff list goes through our proxy which already dual-fetches server-side.
  return 'auto';
}

/** Aktive/abgeschlossene Transaktion (legacy Data-API + #849 /commands/transaction). */
export async function getTransaction(
  stationId: string,
  transactionId: string
): Promise<CitrineosTransaction | undefined> {
  const paths = resolveClientDataApiPaths('getTransaction', clientRestSurface());
  try {
    const result = await citrineosDualFetch<unknown>(paths, {
      method: 'GET',
      query: {
        tenantId: citrineosConfig.tenantId,
        stationId,
        transactionId,
      },
    });
    return normalizeCitrineosTransaction(result);
  } catch {
    return undefined;
  }
}

/** Tarife für Preisanzeige (legacy + #849 /commands/tariff; backend proxy dual-fetches). */
export async function getTariffs(): Promise<CitrineosTariff[]> {
  if (isBackendMode()) {
    const res = await fetchWithTimeout(
      `${apiConfig.baseUrl}/api/citrineos/tariffs`,
      { credentials: 'include' },
      10_000
    );
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
  const paths = resolveClientDataApiPaths('getTariffs', clientRestSurface());
  const raw = await citrineosDualFetch<unknown>(paths, {
    method: 'GET',
    query: { tenantId: citrineosConfig.tenantId },
  });
  return normalizeCitrineosTariffs(raw);
}
