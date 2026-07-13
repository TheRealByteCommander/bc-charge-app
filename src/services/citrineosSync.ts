import {
  citrineosHealth,
  fetchActiveTransaction,
  fetchChargingStationsFromHasura,
  fetchTransactionByRemoteStartId,
  getTariffs,
  getTransaction,
  mapHasuraStations,
  requestStartTransactionForStation,
  requestStopTransactionForStation,
} from '../api/citrineos';
import { getStationById } from '../data/stations';
import { ensureCitrineosAuthorization } from '../api/backend/citrineos';
import { applyTariffCatalogToStations, buildTariffCatalog } from '../api/citrineos/tariffPricing';
import { getStationDataSource, getStations, setStationsFromCitrineos } from '../data/stations';
import { saveStationsOfflineCache } from '../utils/offlineCache';
import { isBackendMode } from './backendMode';
import type { ChargingSession, Station } from '../types';
import { parseConnectorRef } from '../api/citrineos/mappers';
import { normalizeIdToken } from '../utils/ocpp16RemoteStart';

export async function syncStationsFromCitrineos(): Promise<{
  ok: boolean;
  count: number;
  error?: string;
  pricingSyncedAt?: string;
  tariffCount?: number;
}> {
  console.log('[BC Charge] Starting CitrineOS station sync...');
  
  try {
    const healthy = await citrineosHealth();
    console.log('[BC Charge] CitrineOS health check result:', healthy);
    
    if (!healthy) {
      console.warn('[BC Charge] CitrineOS API is not reachable');
      return { ok: false, count: 0, error: 'CitrineOS API nicht erreichbar' };
    }
    
    console.log('[BC Charge] Fetching stations and tariffs from CitrineOS...');
    const [rows, tariffs] = await Promise.all([
      fetchChargingStationsFromHasura(),
      getTariffs().catch((error) => {
        console.error('[BC Charge] Error fetching tariffs:', error);
        return [];
      }),
    ]);
    
    console.log('[BC Charge] Fetched', rows.length, 'stations and', tariffs.length, 'tariffs');
    
    const catalog = buildTariffCatalog(tariffs);
    let mapped = mapHasuraStations(rows, catalog);
    mapped = applyTariffCatalogToStations(mapped, catalog);
    
    console.log('[BC Charge] Mapped', mapped.length, 'stations');
    
    if (mapped.length > 0) {
      setStationsFromCitrineos(mapped);
      void saveStationsOfflineCache(getStations(), 'citrineos');
      return {
        ok: true,
        count: mapped.length,
        pricingSyncedAt: new Date().toISOString(),
        tariffCount: tariffs.length,
      };
    }
    
    console.warn('[BC Charge] No stations found in CitrineOS');
    return { ok: false, count: 0, error: 'Keine Ladestationen in CitrineOS gefunden' };
  } catch (e) {
    console.error('[BC Charge] Error during CitrineOS sync:', e);
    return { ok: false, count: 0, error: e instanceof Error ? e.message : 'Hasura-Sync fehlgeschlagen' };
  }
}

export function resolveEvseConnector(
  station: Station,
  connectorAppId: string
): { evseId: number; connectorId: number } | null {
  const parsed = parseConnectorRef(connectorAppId);
  if (parsed) return parsed;
  if (getStationDataSource() === 'static') {
    const idx = station.connectors.findIndex((c) => c.id === connectorAppId);
    if (idx >= 0) return { evseId: 1, connectorId: idx + 1 };
  }
  return null;
}

export async function startCitrineosCharge(
  station: Station,
  connectorAppId: string,
  idToken: string
): Promise<{ ok: boolean; sessionPatch?: Partial<ChargingSession>; error?: string }> {
  const ref = resolveEvseConnector(station, connectorAppId);
  if (!ref) return { ok: false, error: 'Anschluss-Referenz ungültig' };

  const token = normalizeIdToken(idToken);
  if (!token) return { ok: false, error: 'Ladeberechtigung (membershipId) fehlt' };

  if (isBackendMode()) {
    try {
      const auth = await ensureCitrineosAuthorization(token);
      if (!auth.ok && !auth.skipped) {
        return { ok: false, error: 'Ladeberechtigung konnte nicht in CitrineOS hinterlegt werden' };
      }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'Ladeberechtigung fehlgeschlagen',
      };
    }
  }

  const remoteStartId = Math.floor(Math.random() * 2_000_000_000);
  const confirmations = await requestStartTransactionForStation(station, ref, token, remoteStartId);

  const first = confirmations[0];
  if (!first?.success) {
    const msg =
      typeof first?.payload === 'string'
        ? first.payload
        : 'Ladestart von der Station abgelehnt';
    return { ok: false, error: msg };
  }

  let transactionId: string | undefined;
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    const tx = await fetchTransactionByRemoteStartId(station.id, remoteStartId);
    if (tx?.transactionId) {
      transactionId = tx.transactionId;
      break;
    }
  }

  if (!transactionId) {
    return {
      ok: true,
      sessionPatch: {
        remoteStartId,
        citrineosBacked: true,
        citrineosTransactionId: undefined,
      },
      error: undefined,
    };
  }

  return {
    ok: true,
    sessionPatch: {
      remoteStartId,
      citrineosTransactionId: transactionId,
      citrineosBacked: true,
    },
  };
}

function txToSessionPatch(
  session: ChargingSession,
  tx: {
    transactionId?: string;
    totalKwh?: number | null;
    totalCost?: number;
    chargingState?: string | null;
    isActive?: boolean;
  }
): Partial<ChargingSession> {
  const minutes = session.startedAt
    ? (Date.now() - new Date(session.startedAt).getTime()) / 60000
    : 0;
  let energyKwh = tx.totalKwh ?? session.energyKwh;
  if ((!energyKwh || energyKwh < 0.01) && minutes > 0.05 && tx.isActive !== false) {
    const powerKw = session.powerKw || 11;
    energyKwh = Math.round(Math.min((powerKw * 0.85 * minutes) / 60, 120) * 100) / 100;
  }
  return {
    energyKwh,
    costEur: tx.totalCost ?? session.costEur,
    citrineosTransactionId: tx.transactionId ?? session.citrineosTransactionId,
    chargingState: tx.chargingState,
  };
}

export async function pollCitrineosSession(
  session: ChargingSession
): Promise<Partial<ChargingSession> | null> {
  if (!session.citrineosBacked || !session.stationId) return null;

  if (session.citrineosTransactionId) {
    try {
      const tx = await getTransaction(session.stationId, session.citrineosTransactionId);
      if (tx) return txToSessionPatch(session, tx);
    } catch {
      /* Hasura-Fallback unten */
    }
  }

  if (session.remoteStartId != null) {
    try {
      const tx = await fetchTransactionByRemoteStartId(session.stationId, session.remoteStartId);
      if (tx) return txToSessionPatch(session, tx);
    } catch {
      /* Aktive Transaktion unten */
    }
  }

  try {
    const tx = await fetchActiveTransaction(session.stationId);
    if (tx) return txToSessionPatch(session, tx);
  } catch {
    /* kein Live-Update */
  }

  return null;
}

export async function stopCitrineosCharge(session: ChargingSession): Promise<{ ok: boolean; error?: string }> {
  let transactionId = session.citrineosTransactionId;

  if (!transactionId) {
    const patch = await pollCitrineosSession(session);
    transactionId = patch?.citrineosTransactionId;
  }

  if (!transactionId) {
    return { ok: true };
  }

  const station = getStationById(session.stationId);
  const confirmations = station
    ? await requestStopTransactionForStation(station, transactionId)
    : await requestStopTransactionForStation(
        { id: session.stationId, hardwareFeatures: { ocppVersion: '1.6' } } as Station,
        transactionId
      );

  const first = confirmations[0];
  if (!first?.success) {
    return {
      ok: false,
      error: typeof first?.payload === 'string' ? first.payload : 'Stoppen fehlgeschlagen',
    };
  }
  return { ok: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
