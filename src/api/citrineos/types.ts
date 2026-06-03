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
  evseId?: number | null;
  connectorId?: number | null;
  isActive?: boolean;
  totalKwh?: number | null;
  totalCost?: number;
  startTime?: string;
  endTime?: string;
  chargingState?: string | null;
}

export interface HasuraChargingStationRow {
  id: string;
  isOnline: boolean;
  chargePointVendor?: string | null;
  chargePointModel?: string | null;
  coordinates?: { type: 'Point'; coordinates: [number, number] } | null;
  location?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    postalCode?: string | null;
    country?: string | null;
  } | null;
  evses?: Array<{
    evseId: number;
    connectors?: Array<{
      connectorId: number;
      status: string;
      type?: string | null;
      maximumPowerWatts?: number | null;
      tariff?: CitrineosTariff | null;
    }> | null;
  }> | null;
}
