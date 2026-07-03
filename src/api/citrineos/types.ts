/** CitrineOS API-Typen (abgeleitet von @citrineos/base 1.8.4 / OCPP 2.0.1). */

export interface CitrineosMessageConfirmation {
  success: boolean;
  payload?: string | Record<string, unknown>;
}

export interface CitrineosIdToken {
  idToken: string;
  type: string;
}

export interface CitrineosRequestStartTransactionBody {
  evseId?: number | null;
  idToken: CitrineosIdToken;
  remoteStartId: number;
}

export interface CitrineosRequestStopTransactionBody {
  transactionId: string;
}

export interface CitrineosTariff {
  id?: number;
  currency?: string;
  pricePerKwh?: number;
  pricePerMin?: number;
  pricePerSession?: number;
  taxRate?: number;
}

export interface CitrineosTransaction {
  transactionId: string;
  stationId: string;
  evseDatabaseId?: number | null;
  isActive?: boolean;
  totalKwh?: number | null;
  totalCost?: number;
  timeSpentCharging?: number | null;
  chargingState?: string | null;
}

export interface HasuraChargingStationRow {
  id: number;
  ocppConnectionName: string;
  isOnline: boolean;
  chargePointVendor?: string | null;
  chargePointModel?: string | null;
  coordinates?: { type: 'Point'; coordinates: [number, number] } | null;
  Location?: {
    id?: number;
    name?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
    coordinates?: { type: 'Point'; coordinates: [number, number] } | null;
  } | null;
  Evses?: Array<{
    id: number;
    evseId: number;
    Connectors?: Array<{
      id: number;
      connectorId: number;
      status: string;
      type?: string | null;
      maximumPowerWatts?: number | null;
      tariffId?: number | null;
      Tariff?: CitrineosTariff | null;
    }> | null;
  }> | null;
}
