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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
