import { apiConfig } from '../../config/api';
import { citrineosConfig } from '../../config/citrineos';
import { isBackendMode } from '../../services/backendMode';
import { isPlainObject } from '../../utils/safeJson';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import {
  ApiParseError,
  errorMessageFromPayload,
  HasuraGraphqlEnvelopeSchema,
  parseWithSchema,
  readResponseJson,
  requirePlainObject,
} from '../parse';
import { normalizeHasuraTransactionRow } from './dto';
import { resolveCitrineosStationDbId } from './stationId';
import type { CitrineosTransaction, HasuraChargingStationRow } from './types';

const STATIONS_QUERY = `
  query BcChargeStations($tenantId: Int!) {
    ChargingStations(where: { tenantId: { _eq: $tenantId } }, order_by: { id: asc }) {
      id
      ocppConnectionName
      isOnline
      chargePointVendor
      chargePointModel
      coordinates
      Location {
        id
        name
        address
        city
        postalCode
        country
        coordinates
      }
      Evses {
        id
        evseId
        Connectors {
          id
          connectorId
          status
          type
          maximumPowerWatts
          tariffId
          Tariff {
            id
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

const ACTIVE_TX_QUERY = `
  query BcChargeActiveTransaction($stationId: Int!, $tenantId: Int!) {
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
      evseId
      isActive
      totalKwh
      totalCost
      timeSpentCharging
      chargingState
    }
  }
`;

const TX_BY_REMOTE_START_QUERY = `
  query BcChargeTxByRemoteStart($stationId: Int!, $tenantId: Int!, $remoteStartId: Int!) {
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
      evseId
      isActive
      totalKwh
      totalCost
      timeSpentCharging
      chargingState
    }
  }
`;

export async function hasuraGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const url = isBackendMode() ? `${apiConfig.baseUrl}/api/citrineos/hasura` : citrineosConfig.hasuraUrl;
  if (!isBackendMode() && citrineosConfig.hasuraAdminSecret) {
    headers['x-hasura-admin-secret'] = citrineosConfig.hasuraAdminSecret;
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      credentials: isBackendMode() ? 'include' : 'same-origin',
      headers,
      body: JSON.stringify({ query, variables }),
    },
    12_000
  );

  let json: unknown;
  try {
    json = await readResponseJson(res);
  } catch (e) {
    throw new Error(
      e instanceof ApiParseError
        ? `Hasura ${res.status}: ${e.message}`
        : `Hasura ${res.status}: invalid JSON`
    );
  }

  let envelope: { data?: unknown; errors?: Array<{ message?: string }> };
  try {
    envelope = parseWithSchema(json ?? {}, HasuraGraphqlEnvelopeSchema, 'hasura');
  } catch {
    throw new Error(`Hasura ${res.status}: non-object payload`);
  }

  const errors = envelope.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    const msg =
      isPlainObject(first) && typeof first.message === 'string'
        ? first.message
        : errorMessageFromPayload(envelope, `Hasura ${res.status}`);
    throw new Error(msg);
  }
  if (!res.ok) {
    throw new Error(`Hasura ${res.status}`);
  }
  if (envelope.data === undefined) {
    throw new Error('Hasura response missing data');
  }
  // GraphQL data root is almost always an object; guard without bare cast of the HTTP body.
  return requirePlainObject(envelope.data, 'hasura data') as T;
}

export async function fetchChargingStationsFromHasura(): Promise<HasuraChargingStationRow[]> {
  const data = await hasuraGraphql<{ ChargingStations: HasuraChargingStationRow[] }>(STATIONS_QUERY, {
    tenantId: citrineosConfig.tenantId,
  });
  return data.ChargingStations ?? [];
}

export async function fetchActiveTransaction(
  stationAppId: string
): Promise<CitrineosTransaction | undefined> {
  const data = await hasuraGraphql<{ Transactions: unknown[] }>(ACTIVE_TX_QUERY, {
    stationId: resolveCitrineosStationDbId(stationAppId),
    tenantId: citrineosConfig.tenantId,
  });
  return normalizeHasuraTransactionRow(data.Transactions?.[0]);
}

export async function fetchTransactionByRemoteStartId(
  stationAppId: string,
  remoteStartId: number
): Promise<CitrineosTransaction | undefined> {
  const data = await hasuraGraphql<{ Transactions: unknown[] }>(TX_BY_REMOTE_START_QUERY, {
    stationId: resolveCitrineosStationDbId(stationAppId),
    tenantId: citrineosConfig.tenantId,
    remoteStartId,
  });
  return normalizeHasuraTransactionRow(data.Transactions?.[0]);
}
