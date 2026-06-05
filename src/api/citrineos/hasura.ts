import { apiConfig } from '../../config/api';
import { citrineosConfig } from '../../config/citrineos';
import { isBackendMode } from '../../services/backendMode';
import type { CitrineosTransaction, HasuraChargingStationRow } from './types';

const STATIONS_QUERY = `
  query BcChargeStations($tenantId: Int!) {
    ChargingStation(where: { tenantId: { _eq: $tenantId } }, order_by: { id: asc }) {
      id
      isOnline
      chargePointVendor
      chargePointModel
      coordinates
      location {
        name
        address
        city
        postalCode
        country
      }
      evses {
        evseId
        connectors {
          connectorId
          status
          type
          maximumPowerWatts
          tariff {
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
  query BcChargeActiveTransaction($stationId: String!, $tenantId: Int!) {
    Transaction(
      where: {
        stationId: { _eq: $stationId }
        tenantId: { _eq: $tenantId }
        isActive: { _eq: true }
      }
      order_by: { startTime: desc }
      limit: 1
    ) {
      transactionId
      stationId
      evseId
      connectorId
      isActive
      totalKwh
      totalCost
      startTime
      endTime
      chargingState
    }
  }
`;

const TX_BY_REMOTE_START_QUERY = `
  query BcChargeTxByRemoteStart($stationId: String!, $tenantId: Int!, $remoteStartId: Int!) {
    Transaction(
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
      connectorId
      isActive
      totalKwh
      totalCost
      startTime
      chargingState
    }
  }
`;

async function hasuraRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const url = isBackendMode() ? `${apiConfig.baseUrl}/api/citrineos/hasura` : citrineosConfig.hasuraUrl;
  if (!isBackendMode() && citrineosConfig.hasuraAdminSecret) {
    headers['x-hasura-admin-secret'] = citrineosConfig.hasuraAdminSecret;
  }

  const res = await fetch(url, {
    method: 'POST',
    credentials: isBackendMode() ? 'include' : 'same-origin',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message ?? `Hasura ${res.status}`);
  }
  return json.data as T;
}

export async function fetchChargingStationsFromHasura(): Promise<HasuraChargingStationRow[]> {
  const data = await hasuraRequest<{ ChargingStation: HasuraChargingStationRow[] }>(STATIONS_QUERY, {
    tenantId: citrineosConfig.tenantId,
  });
  return data.ChargingStation ?? [];
}

export async function fetchActiveTransaction(
  stationId: string
): Promise<CitrineosTransaction | undefined> {
  const data = await hasuraRequest<{ Transaction: CitrineosTransaction[] }>(ACTIVE_TX_QUERY, {
    stationId,
    tenantId: citrineosConfig.tenantId,
  });
  return data.Transaction?.[0];
}

export async function fetchTransactionByRemoteStartId(
  stationId: string,
  remoteStartId: number
): Promise<CitrineosTransaction | undefined> {
  const data = await hasuraRequest<{ Transaction: CitrineosTransaction[] }>(TX_BY_REMOTE_START_QUERY, {
    stationId,
    tenantId: citrineosConfig.tenantId,
    remoteStartId,
  });
  return data.Transaction?.[0];
}
