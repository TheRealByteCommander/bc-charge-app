import {
  citrineosHealth,
  fetchChargingStationsFromHasura,
  fetchTransactionByRemoteStartId,
  getTariffs,
  getTransaction,
  mapHasuraStations,
  requestStartTransaction,
  requestStopTransaction,
} from '../api/citrineos';
import { applyTariffCatalogToStations, buildTariffCatalog } from '../api/citrineos/tariffPricing';
import { citrineosConfig } from '../config/citrineos';
import { getStationDataSource, getStations, setStationsFromCitrineos } from '../data/stations';
import { saveStationsOfflineCache } from '../utils/offlineCache';
import type { ChargingSession, Station } from '../types';
import { parseConnectorRef } from '../api/citrineos/mappers';

export async function syncStationsFromCitrineos(): Promise<{
  ok: boolean;
  count: number;
  error?: string;
  pricingSyncedAt?: string;
  tariffCount?: number;
}> {
  const healthy = await citrineosHealth();
  if (!healthy) {
    return { ok: false, count: 0, error: 'CitrineOS API nicht erreichbar' };
  }
  try {
    const [rows, tariffs] = await Promise.all([
      fetchChargingStationsFromHasura(),
      getTariffs().catch(() => []),
    ]);
    const catalog = buildTariffCatalog(tariffs);
    let mapped = mapHasuraStations(rows, catalog);
    mapped = applyTariffCatalogToStations(mapped, catalog);
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
    return { ok: false, count: 0, error: 'Keine Ladestationen in CitrineOS gefunden' };
  } catch (e) {
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

  const remoteStartId = Math.floor(Math.random() * 2_000_000_000);
  const confirmations = await requestStartTransaction(station.id, {
    evseId: ref.evseId,
    remoteStartId,
    idToken: { idToken, type: citrineosConfig.idTokenType },
  });

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

export async function pollCitrineosSession(
  session: ChargingSession
): Promise<Partial<ChargingSession> | null> {
  if (!session.citrineosBacked || !session.stationId) return null;

  if (session.citrineosTransactionId) {
    const tx = await getTransaction(session.stationId, session.citrineosTransactionId);
    if (tx) {
      return {
        energyKwh: tx.totalKwh ?? session.energyKwh,
        costEur: tx.totalCost ?? session.costEur,
        citrineosTransactionId: tx.transactionId,
        chargingState: tx.chargingState,
      };
    }
  }

  if (session.remoteStartId != null) {
    const tx = await fetchTransactionByRemoteStartId(session.stationId, session.remoteStartId);
    if (tx) {
      return {
        energyKwh: tx.totalKwh ?? session.energyKwh,
        costEur: tx.totalCost ?? session.costEur,
        citrineosTransactionId: tx.transactionId,
        chargingState: tx.chargingState,
      };
    }
  }

  return null;
}

export async function stopCitrineosCharge(session: ChargingSession): Promise<{ ok: boolean; error?: string }> {
  if (!session.citrineosTransactionId) {
    return { ok: true };
  }
  const confirmations = await requestStopTransaction(session.stationId, {
    transactionId: session.citrineosTransactionId,
  });
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
