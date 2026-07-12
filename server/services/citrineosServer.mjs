/** Serverseitige CitrineOS/Hasura-Hilfen für Ad-Hoc-Laden (ohne Frontend-Abhängigkeit). */

import { mapConnectorStatus } from '../utils/ocppStatus.mjs';
import { buildOcpp16RemoteStartBody } from '../utils/ocpp16RemoteStart.mjs';
import { ensureCitrineosAuthorization } from './citrineosAuth.mjs';

function citrineosApiUrl() {
  return (process.env.CITRINEOS_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
}

function hasuraUrl() {
  return (process.env.CITRINEOS_HASURA_URL ?? 'http://localhost:8090/v1/graphql').replace(/\/$/, '');
}

function tenantId() {
  return Number(process.env.CITRINEOS_TENANT_ID ?? '1');
}

function idTokenType() {
  return process.env.CITRINEOS_ID_TOKEN_TYPE ?? 'Central';
}

export function isCitrineosConfigured() {
  return Boolean(process.env.CITRINEOS_API_URL || process.env.CITRINEOS_HASURA_URL);
}

const STATION_BY_NAME_QUERY = `
  query BcAdhocStationByName($tenantId: Int!, $connectionName: String!) {
    ChargingStations(
      where: {
        tenantId: { _eq: $tenantId }
        ocppConnectionName: { _eq: $connectionName }
      }
      limit: 1
    ) {
      id
      ocppConnectionName
      isOnline
      chargePointVendor
      chargePointModel
      Location {
        name
        address
        city
        postalCode
      }
      Evses {
        evseId
        Connectors {
          connectorId
          status
          type
          maximumPowerWatts
          Tariff {
            pricePerKwh
            pricePerMin
            pricePerSession
            currency
          }
        }
      }
    }
  }
`;

const STATION_BY_DB_ID_QUERY = `
  query BcAdhocStationByDbId($tenantId: Int!, $stationDbId: Int!) {
    ChargingStations(
      where: {
        tenantId: { _eq: $tenantId }
        id: { _eq: $stationDbId }
      }
      limit: 1
    ) {
      id
      ocppConnectionName
      isOnline
      chargePointVendor
      chargePointModel
      Location {
        name
        address
        city
        postalCode
      }
      Evses {
        evseId
        Connectors {
          connectorId
          status
          type
          maximumPowerWatts
          Tariff {
            pricePerKwh
            pricePerMin
            pricePerSession
            currency
          }
        }
      }
    }
  }
`;

const TX_BY_REMOTE_START_QUERY = `
  query BcAdhocTxByRemoteStart($stationId: Int!, $tenantId: Int!, $remoteStartId: Int!) {
    Transactions(
      where: {
        stationId: { _eq: $stationId }
        tenantId: { _eq: $tenantId }
        remoteStartId: { _eq: $remoteStartId }
      }
      limit: 1
    ) {
      transactionId
      stationId
      isActive
      totalKwh
      totalCost
      chargingState
    }
  }
`;

const TX_BY_ID_QUERY = `
  query BcAdhocTxById($stationId: Int!, $tenantId: Int!, $transactionId: String!) {
    Transactions(
      where: {
        stationId: { _eq: $stationId }
        tenantId: { _eq: $tenantId }
        transactionId: { _eq: $transactionId }
      }
      limit: 1
    ) {
      transactionId
      stationId
      isActive
      totalKwh
      totalCost
      chargingState
    }
  }
`;

const ACTIVE_TX_QUERY = `
  query BcActiveTx($stationId: Int!, $tenantId: Int!) {
    Transactions(
      where: {
        stationId: { _eq: $stationId }
        tenantId: { _eq: $tenantId }
        isActive: { _eq: true }
      }
      order_by: { timeSpentCharging: desc }
      limit: 1
    ) {
      transactionId
      stationId
      isActive
      totalKwh
      totalCost
      chargingState
    }
  }
`;

async function hasuraRequest(query, variables) {
  if (!process.env.CITRINEOS_HASURA_URL) {
    throw Object.assign(new Error('Hasura nicht konfiguriert'), { status: 503 });
  }
  const headers = { 'Content-Type': 'application/json' };
  const secret = process.env.CITRINEOS_HASURA_ADMIN_SECRET;
  if (secret) headers['x-hasura-admin-secret'] = secret;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let res;
  try {
    res = await fetch(hasuraUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    throw Object.assign(new Error(json.errors?.[0]?.message ?? `Hasura ${res.status}`), {
      status: 502,
    });
  }
  return json.data;
}

function parseConnectorRef(connectorAppId) {
  const m = /^evse-(\d+)-conn-(\d+)$/.exec(connectorAppId ?? '');
  if (!m) return null;
  return { evseId: Number(m[1]), connectorId: Number(m[2]) };
}

function parseStationDbId(stationId) {
  const parsed = Number(stationId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function fetchStationRow(stationId) {
  const tid = tenantId();
  let data = await hasuraRequest(STATION_BY_NAME_QUERY, {
    tenantId: tid,
    connectionName: String(stationId),
  });
  let row = data.ChargingStations?.[0];
  if (!row) {
    const dbId = parseStationDbId(stationId);
    if (dbId != null) {
      data = await hasuraRequest(STATION_BY_DB_ID_QUERY, { tenantId: tid, stationDbId: dbId });
      row = data.ChargingStations?.[0];
    }
  }
  return row;
}

export async function resolveAdhocConnector(stationId, connectorAppId) {
  const ref = parseConnectorRef(connectorAppId);
  if (!ref) {
    throw Object.assign(new Error('Ungültige Anschluss-Referenz'), { status: 400 });
  }

  const row = await fetchStationRow(stationId);
  if (!row) {
    throw Object.assign(new Error('Station nicht gefunden'), { status: 404 });
  }

  const resolvedStationId = row.ocppConnectionName || String(row.id);
  let connector = null;
  for (const evse of row.Evses ?? []) {
    if (evse.evseId !== ref.evseId) continue;
    for (const conn of evse.Connectors ?? []) {
      if (conn.connectorId === ref.connectorId) {
        const tariff = conn.Tariff ?? {};
        const powerKw = conn.maximumPowerWatts
          ? Math.round(conn.maximumPowerWatts / 1000)
          : 22;
        connector = {
          id: connectorAppId,
          evseId: ref.evseId,
          connectorId: ref.connectorId,
          type: conn.type ?? 'Type2',
          powerKw: powerKw > 0 ? powerKw : 22,
          status: mapConnectorStatus(conn.status, row.isOnline),
          ocppRawStatus: conn.status ?? undefined,
          pricePerKwh: Number(tariff.pricePerKwh ?? 0.49),
          pricePerMin: Number(tariff.pricePerMin ?? 0),
          sessionFee: Number(tariff.pricePerSession ?? 0),
          currency: (tariff.currency ?? 'EUR').toLowerCase(),
        };
        break;
      }
    }
  }

  if (!connector) {
    throw Object.assign(new Error('Anschluss nicht gefunden'), { status: 404 });
  }

  const loc = row.Location ?? {};
  return {
    stationId: resolvedStationId,
    stationDatabaseId: row.id,
    stationName:
      loc.name ??
      `${row.chargePointVendor ?? 'BC Charge'} ${row.chargePointModel ?? resolvedStationId}`.trim(),
    address: [loc.address, loc.postalCode, loc.city].filter(Boolean).join(', ') || '—',
    isOnline: Boolean(row.isOnline),
    chargePointVendor: row.chargePointVendor ?? undefined,
    chargePointModel: row.chargePointModel ?? undefined,
    connector,
  };
}

function isOcpp16Station(row) {
  const vendor = String(row?.chargePointVendor ?? '').toLowerCase();
  const model = String(row?.chargePointModel ?? '').toLowerCase();
  return (
    vendor.includes('go-e') ||
    vendor.includes('goe') ||
    vendor.includes('elinta') ||
    model.includes('citycharge')
  );
}

async function citrineosDataGet(path, query, timeoutMs = 8000) {
  if (!process.env.CITRINEOS_API_URL) return null;
  const url = new URL(path, `${citrineosApiUrl()}/`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTransactionFromRestApi(stationId, transactionId) {
  return citrineosDataGet('/data/transactions/transactionType', {
    tenantId: tenantId(),
    stationId,
    transactionId,
  });
}

function normalizeTransactionRow(tx) {
  if (!tx || typeof tx !== 'object') return null;
  return {
    transactionId: tx.transactionId ?? tx.id ?? null,
    isActive: tx.isActive ?? tx.active ?? null,
    totalKwh: tx.totalKwh ?? tx.totalEnergyKwh ?? tx.energyKwh ?? null,
    totalCost: tx.totalCost ?? tx.cost ?? null,
    chargingState: tx.chargingState ?? tx.state ?? null,
  };
}

function estimateEnergyKwh(session, minutes) {
  const powerKw = Number(session.powerKw) || 11;
  const efficiency = 0.85;
  const estimated = (powerKw * efficiency * minutes) / 60;
  return Math.round(Math.min(estimated, 120) * 100) / 100;
}

export async function stopAccountTransaction(stationId, transactionId, stationRow) {
  if (!transactionId) {
    throw Object.assign(new Error('Keine Transaktions-ID für Stoppen verfügbar'), { status: 400 });
  }

  const useOcpp16 = stationRow ? isOcpp16Station(stationRow) : false;
  let confirmations;

  if (useOcpp16) {
    try {
      confirmations = await citrineosMessage(
        '/ocpp/1.6/evdriver/remoteStopTransaction',
        stationId,
        { transactionId: Number(transactionId) || transactionId },
        15_000
      );
    } catch {
      confirmations = null;
    }
  }

  if (!confirmations) {
    confirmations = await citrineosMessage(
      '/ocpp/2.0.1/evdriver/requestStopTransaction',
      stationId,
      { transactionId: String(transactionId) },
      15_000
    );
  }

  const first = Array.isArray(confirmations) ? confirmations[0] : confirmations;
  const accepted =
    first?.success === true ||
    String(first?.status ?? first?.payload ?? '').toLowerCase() === 'accepted';
  if (!accepted) {
    const msg =
      typeof first?.payload === 'string'
        ? first.payload
        : typeof first?.status === 'string'
          ? first.status
          : 'Stoppen fehlgeschlagen';
    throw Object.assign(new Error(msg), { status: 502 });
  }
  return true;
}

async function citrineosMessage(path, stationId, body, timeoutMs = 12_000) {
  if (!process.env.CITRINEOS_API_URL) {
    throw Object.assign(new Error('CitrineOS API nicht konfiguriert'), { status: 503 });
  }
  const url = new URL(path, `${citrineosApiUrl()}/`);
  url.searchParams.set('identifier', stationId);
  url.searchParams.set('tenantId', String(tenantId()));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const msg =
      typeof parsed === 'object' && parsed?.message
        ? String(parsed.message)
        : `CitrineOS ${res.status}`;
    throw Object.assign(new Error(msg), { status: 502 });
  }
  return parsed;
}

export async function startAdhocTransaction(stationId, evseId, connectorId, idToken, stationRow) {
  await ensureCitrineosAuthorization(idToken);

  const remoteStartId = Math.floor(Math.random() * 2_000_000_000);
  const useOcpp16 = stationRow ? isOcpp16Station(stationRow) : false;

  let confirmations;
  if (useOcpp16) {
    try {
      const maxPowerWatts = stationRow?.connector?.powerKw
        ? stationRow.connector.powerKw * 1000
        : undefined;
      confirmations = await citrineosMessage(
        '/ocpp/1.6/evdriver/remoteStartTransaction',
        stationId,
        buildOcpp16RemoteStartBody({
          connectorId,
          idTag: idToken,
          vendor: stationRow?.chargePointVendor,
          maxPowerWatts,
        }),
        15_000
      );
    } catch {
      confirmations = null;
    }
  }

  if (!confirmations) {
    confirmations = await citrineosMessage(
      '/ocpp/2.0.1/evdriver/requestStartTransaction',
      stationId,
      {
        evseId,
        remoteStartId,
        idToken: { idToken, type: idTokenType() },
      },
      15_000
    );
  }

  const first = Array.isArray(confirmations) ? confirmations[0] : confirmations;
  const accepted =
    first?.success === true ||
    String(first?.status ?? first?.payload ?? '').toLowerCase() === 'accepted';
  if (!accepted) {
    const msg =
      typeof first?.payload === 'string'
        ? first.payload
        : typeof first?.status === 'string'
          ? first.status
          : 'Ladestart von der Station abgelehnt';
    throw Object.assign(new Error(msg), { status: 502 });
  }

  let transactionId;
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    const tx = await fetchTransactionByRemoteStartId(
      stationId,
      remoteStartId,
      stationRow?.stationDatabaseId ?? stationRow?.id
    );
    if (tx?.transactionId) {
      transactionId = tx.transactionId;
      break;
    }
  }

  return { remoteStartId, transactionId };
}

export async function stopAdhocTransaction(stationId, transactionId) {
  const confirmations = await citrineosMessage(
    '/ocpp/2.0.1/evdriver/requestStopTransaction',
    stationId,
    { transactionId }
  );
  const first = Array.isArray(confirmations) ? confirmations[0] : null;
  if (!first?.success) {
    const msg = typeof first?.payload === 'string' ? first.payload : 'Stoppen fehlgeschlagen';
    throw Object.assign(new Error(msg), { status: 502 });
  }
  return true;
}

export async function fetchTransactionByRemoteStartId(stationId, remoteStartId, stationDatabaseId) {
  const dbId =
    stationDatabaseId ??
    (await fetchStationRow(stationId))?.id ??
    parseStationDbId(stationId);
  if (dbId == null) {
    throw Object.assign(new Error(`Keine CitrineOS-Datenbank-ID für Station „${stationId}“`), { status: 404 });
  }
  const data = await hasuraRequest(TX_BY_REMOTE_START_QUERY, {
    stationId: dbId,
    tenantId: tenantId(),
    remoteStartId,
  });
  return data.Transactions?.[0] ?? null;
}

export async function fetchTransactionById(stationId, transactionId, stationDatabaseId) {
  const dbId =
    stationDatabaseId ??
    (await fetchStationRow(stationId))?.id ??
    parseStationDbId(stationId);
  if (dbId == null) {
    throw Object.assign(new Error(`Keine CitrineOS-Datenbank-ID für Station „${stationId}“`), { status: 404 });
  }
  const data = await hasuraRequest(TX_BY_ID_QUERY, {
    stationId: dbId,
    tenantId: tenantId(),
    transactionId,
  });
  return data.Transactions?.[0] ?? null;
}

export async function fetchActiveTransactionForStation(stationId, stationDatabaseId) {
  const dbId =
    stationDatabaseId ??
    (await fetchStationRow(stationId))?.id ??
    parseStationDbId(stationId);
  if (dbId == null) return null;
  const data = await hasuraRequest(ACTIVE_TX_QUERY, {
    stationId: dbId,
    tenantId: tenantId(),
  });
  return data.Transactions?.[0] ?? null;
}

function computeCostFromSession(energyKwh, session, minutes = 0) {
  const kwh = Number(energyKwh) || 0;
  const min = Number(minutes) || 0;
  const energy = kwh * (session.pricePerKwh ?? 0.49);
  const time = min * (session.pricePerMin ?? 0);
  const fee = session.sessionFee ?? 0;
  return Math.round((energy + time + fee) * 100) / 100;
}

/** Live-Daten aus CitrineOS für Konto-Sessions (Hasura, unabhängig vom Frontend-Station-Cache). */
export async function syncAccountSessionFromCitrineos(session) {
  if (session?.status !== 'active') return session;
  if (!isCitrineosConfigured()) return session;

  const citrineosBacked = session.citrineosBacked !== false;

  try {
    const stationRow = await fetchStationRow(session.stationId);
    const stationDbId =
      session.citrineosStationDbId ?? stationRow?.id ?? parseStationDbId(session.stationId);
    if (stationDbId == null) return session;

    let tx = null;
    if (citrineosBacked && session.citrineosTransactionId) {
      tx = await fetchTransactionById(session.stationId, session.citrineosTransactionId, stationDbId);
      if (!tx?.totalKwh && session.citrineosTransactionId) {
        const restTx = normalizeTransactionRow(
          await fetchTransactionFromRestApi(session.stationId, session.citrineosTransactionId)
        );
        if (restTx) tx = { ...tx, ...restTx };
      }
    }
    if (!tx && citrineosBacked && session.remoteStartId != null) {
      tx = await fetchTransactionByRemoteStartId(session.stationId, session.remoteStartId, stationDbId);
    }
    if (!tx && citrineosBacked) {
      tx = await fetchActiveTransactionForStation(session.stationId, stationDbId);
    }
    if (!tx) {
      return { ...session, citrineosStationDbId: stationDbId, citrineosBacked: citrineosBacked || Boolean(stationRow) };
    }

    const minutes = session.startedAt
      ? (Date.now() - new Date(session.startedAt).getTime()) / 60000
      : 0;
    let energyKwh = Number(tx.totalKwh ?? session.energyKwh) || 0;
    if (energyKwh < 0.01 && tx.isActive !== false && minutes > 0.05) {
      energyKwh = Math.max(energyKwh, estimateEnergyKwh(session, minutes));
    }
    const costEur =
      tx.totalCost != null ? Number(tx.totalCost) : computeCostFromSession(energyKwh, session, minutes);

    return {
      ...session,
      citrineosBacked: true,
      citrineosStationDbId: stationDbId,
      energyKwh,
      costEur,
      citrineosTransactionId: tx.transactionId ?? session.citrineosTransactionId,
      chargingState: tx.chargingState ?? session.chargingState,
      citrineosTxActive: tx.isActive ?? true,
    };
  } catch (e) {
    console.warn('[bc-charge] CitrineOS-Session-Sync fehlgeschlagen:', e);
    return session;
  }
}

/** Remote-Stop + finaler Sync für Konto-Ladesitzungen. */
export async function stopAndSyncAccountSession(session) {
  if (!session || session.status !== 'active') return session;

  let synced = await syncAccountSessionFromCitrineos(session);
  const stationRow = await fetchStationRow(synced.stationId).catch(() => null);

  if (synced.citrineosTransactionId) {
    try {
      await stopAccountTransaction(synced.stationId, synced.citrineosTransactionId, stationRow);
      await sleep(2000);
    } catch (e) {
      console.warn('[bc-charge] CitrineOS-Stop fehlgeschlagen:', e);
      // Trotzdem abschließen – Nutzer hat physisch gestoppt oder Tx-ID fehlt
    }
  }

  synced = await syncAccountSessionFromCitrineos(synced);
  return synced;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
