/**
 * Shared offline-station shape guards + normalizers.
 * Used by localStorage offline cache and IndexedDB helpers (parse-don't-cast).
 */

import type { Connector, ConnectorStatus, ConnectorType, KnownHardwareModel, Station } from '../types';
import { asArrayOf, isPlainObject } from './safeJson';

const CONNECTOR_TYPES = new Set<ConnectorType>(['CCS', 'Type2', 'CHAdeMO']);
const CONNECTOR_STATUSES = new Set<ConnectorStatus>([
  'available',
  'occupied',
  'offline',
  'reserved',
]);
const HARDWARE_MODELS = new Set<KnownHardwareModel>(['CityCharge H2', 'go-e', 'generic']);

export interface StationsCacheMeta {
  key: string;
  savedAt: string;
  source: string;
  count: number;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

/** Narrow a cached connector row; drop corrupt partials. */
export function isCachedConnector(value: unknown): value is Connector {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string' || !value.id) return false;
  if (typeof value.evseId !== 'string' || !value.evseId) return false;
  if (typeof value.type !== 'string' || !CONNECTOR_TYPES.has(value.type as ConnectorType)) {
    return false;
  }
  if (typeof value.status !== 'string' || !CONNECTOR_STATUSES.has(value.status as ConnectorStatus)) {
    return false;
  }
  if (asFiniteNumber(value.powerKw) == null) return false;
  if (asFiniteNumber(value.pricePerKwh) == null) return false;
  return true;
}

function normalizeConnector(raw: Connector): Connector {
  const powerKw = asFiniteNumber(raw.powerKw) ?? 0;
  const pricePerKwh = asFiniteNumber(raw.pricePerKwh) ?? 0;
  const out: Connector = {
    id: raw.id,
    type: raw.type,
    powerKw,
    status: raw.status,
    evseId: raw.evseId,
    pricePerKwh,
  };
  const ocppRawStatus = asOptionalString(raw.ocppRawStatus);
  if (ocppRawStatus !== undefined) out.ocppRawStatus = ocppRawStatus;
  const pricePerMin = asFiniteNumber(raw.pricePerMin ?? null);
  if (pricePerMin != null) out.pricePerMin = pricePerMin;
  const sessionFee = asFiniteNumber(raw.sessionFee ?? null);
  if (sessionFee != null) out.sessionFee = sessionFee;
  const currency = asOptionalString(raw.currency);
  if (currency !== undefined) out.currency = currency;
  const tariffId = asFiniteNumber(raw.tariffId ?? null);
  if (tariffId != null) out.tariffId = tariffId;
  if (typeof raw.livePricing === 'boolean') out.livePricing = raw.livePricing;
  if (typeof raw.priceKnown === 'boolean') out.priceKnown = raw.priceKnown;
  const evseNumber = asFiniteNumber(raw.evseNumber ?? null);
  if (evseNumber != null) out.evseNumber = evseNumber;
  const connectorNumber = asFiniteNumber(raw.connectorNumber ?? null);
  if (connectorNumber != null) out.connectorNumber = connectorNumber;
  return out;
}

/** Narrow a cached station row; drop corrupt partials that would crash UI. */
export function isCachedStation(value: unknown): value is Station {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== 'string' || !value.id) return false;
  if (typeof value.evseCode !== 'string') return false;
  if (typeof value.name !== 'string' || !value.name) return false;
  if (typeof value.address !== 'string') return false;
  if (typeof value.city !== 'string') return false;
  if (typeof value.zip !== 'string') return false;
  if (asFiniteNumber(value.lat) == null) return false;
  if (asFiniteNumber(value.lng) == null) return false;
  if (!Array.isArray(value.connectors)) return false;
  const connectors = asArrayOf(value.connectors, isCachedConnector);
  if (connectors.length === 0) return false;
  return true;
}

export function normalizeCachedStation(value: unknown): Station | null {
  if (!isCachedStation(value)) return null;
  const lat = asFiniteNumber(value.lat) ?? 0;
  const lng = asFiniteNumber(value.lng) ?? 0;
  const rating = asFiniteNumber(value.rating) ?? 0;
  const reviewCount = asFiniteNumber(value.reviewCount) ?? 0;
  const connectors = asArrayOf(value.connectors, isCachedConnector).map(normalizeConnector);
  if (connectors.length === 0) return null;

  const station: Station = {
    id: value.id,
    evseCode: value.evseCode,
    name: value.name,
    address: value.address,
    city: value.city,
    zip: value.zip,
    lat,
    lng,
    amenities: asStringArray(value.amenities),
    openingHours: typeof value.openingHours === 'string' ? value.openingHours : '24/7',
    operator: 'BC Charge',
    network: typeof value.network === 'string' ? value.network : 'BC Charge',
    rating,
    reviewCount,
    imageGradient:
      typeof value.imageGradient === 'string' ? value.imageGradient : 'from-bc-blue/30 to-bc-surface',
    connectors,
    greenEnergy: value.greenEnergy !== false,
    accessible: value.accessible !== false,
  };

  const chargePointVendor = asOptionalString(value.chargePointVendor);
  if (chargePointVendor !== undefined) station.chargePointVendor = chargePointVendor;
  const chargePointModel = asOptionalString(value.chargePointModel);
  if (chargePointModel !== undefined) station.chargePointModel = chargePointModel;
  if (
    typeof value.hardwareModel === 'string' &&
    HARDWARE_MODELS.has(value.hardwareModel as KnownHardwareModel)
  ) {
    station.hardwareModel = value.hardwareModel as KnownHardwareModel;
  }
  if (isPlainObject(value.hardwareFeatures)) {
    const hf = value.hardwareFeatures;
    station.hardwareFeatures = {
      midCertifiedMeters: Boolean(hf.midCertifiedMeters),
      dynamicLoadManagement: Boolean(hf.dynamicLoadManagement),
      ocppVersion: hf.ocppVersion === '1.6' ? '1.6' : '2.0.1',
      multiConnector: Boolean(hf.multiConnector),
    };
  }
  const citrineosDatabaseId = asFiniteNumber(value.citrineosDatabaseId ?? null);
  if (citrineosDatabaseId != null) station.citrineosDatabaseId = citrineosDatabaseId;
  return station;
}

/** Normalize a station list; drops corrupt rows. */
export function normalizeCachedStations(values: unknown): Station[] {
  if (!Array.isArray(values)) return [];
  const out: Station[] = [];
  for (const item of values) {
    const station = normalizeCachedStation(item);
    if (station) out.push(station);
  }
  return out;
}

/** Narrow IndexedDB / offline cache meta rows. */
export function normalizeStationsCacheMeta(
  value: unknown,
  fallbackCount = 0
): StationsCacheMeta | null {
  if (!isPlainObject(value)) return null;
  const key = typeof value.key === 'string' && value.key ? value.key : 'stations_cache';
  const savedAt = typeof value.savedAt === 'string' ? value.savedAt : '';
  const source = typeof value.source === 'string' && value.source ? value.source : 'unknown';
  const countRaw = asFiniteNumber(value.count);
  const count = countRaw != null && countRaw >= 0 ? Math.floor(countRaw) : fallbackCount;
  if (!savedAt && source === 'unknown' && countRaw == null && typeof value.key !== 'string') {
    return null;
  }
  return { key, savedAt, source, count };
}
