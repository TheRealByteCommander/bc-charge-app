/**
 * Parse-don't-cast helpers for OCPP MeterValues / Start|StopTransaction /
 * TransactionEvent payloads (1.6 + 2.0.1, camel + snake aliases).
 * LM stays Zod-free; corrupt samples are dropped instead of cast.
 */

import { isPlainObject, readOptionalFiniteNumber } from './chargingScheduleShape';

export type OcppTransactionIds = {
  stationId: string | null;
  connectorId: number;
  transactionId: string | number | undefined;
  idTag: string | undefined;
};

function readNestedObject(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}

/**
 * Station id from envelope top-level or payload aliases (Citrine / OCPP 1.6+2.x).
 */
export function extractStationId(message: unknown, payload: unknown): string | null {
  const msg = isPlainObject(message) ? message : null;
  const p = isPlainObject(payload) ? payload : null;
  const raw =
    msg?.stationId ??
    p?.stationId ??
    p?.chargingStationId ??
    p?.station_id ??
    p?.charging_station_id ??
    null;
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  return s || null;
}

/**
 * OCPP 2.0.1: connector under payload.evse; 1.6: payload.connectorId.
 * Falls back to 0 when missing/corrupt (matches prior LoadManager behaviour).
 */
export function extractConnectorId(payload: unknown): number {
  const p = isPlainObject(payload) ? payload : null;
  if (!p) return 0;
  const evse = readNestedObject(p.evse);
  const raw =
    p.connectorId ??
    p.connector_id ??
    evse?.connectorId ??
    evse?.connector_id ??
    evse?.id ??
    0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * OCPP 2.0.1 transactionId lives in transactionInfo; 1.6 is flat on payload.
 */
export function extractTransactionId(payload: unknown): string | number | undefined {
  const p = isPlainObject(payload) ? payload : null;
  if (!p) return undefined;
  const info = readNestedObject(p.transactionInfo) ?? readNestedObject(p.transaction_info);
  const tx = readNestedObject(p.transaction);
  const raw =
    p.transactionId ??
    p.transaction_id ??
    info?.transactionId ??
    info?.transaction_id ??
    tx?.id ??
    tx?.transactionId ??
    tx?.transaction_id;
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t || undefined;
  }
  // Reject objects/arrays; stringify only primitive-ish leftovers that are finite numbers
  const n = Number(raw);
  if (typeof raw === 'boolean' || raw instanceof Date || Array.isArray(raw) || isPlainObject(raw)) {
    return undefined;
  }
  if (Number.isFinite(n)) return n;
  const s = String(raw).trim();
  return s || undefined;
}

/**
 * idTag / idToken across OCPP 1.6 flat and 2.0.1 IdTokenType.
 */
export function extractIdTag(payload: unknown): string | undefined {
  const p = isPlainObject(payload) ? payload : null;
  if (!p) return undefined;
  const idTokenObj = readNestedObject(p.idToken) ?? readNestedObject(p.id_token);

  let raw: unknown;
  if (typeof p.idTag === 'string' || typeof p.idTag === 'number') {
    raw = p.idTag;
  } else if (typeof p.id_tag === 'string' || typeof p.id_tag === 'number') {
    raw = p.id_tag;
  } else if (idTokenObj) {
    raw = idTokenObj.idToken ?? idTokenObj.id_token;
  } else if (typeof p.idToken === 'string' || typeof p.idToken === 'number') {
    raw = p.idToken;
  } else {
    return undefined;
  }

  if (raw == null || typeof raw === 'object') return undefined;
  const s = String(raw).trim();
  return s || undefined;
}

/** Prefer nested meterValue arrays used by MeterValues + TransactionEvent. */
export function extractMeterValueArray(payload: unknown): unknown {
  const p = isPlainObject(payload) ? payload : null;
  if (!p) return undefined;
  const info = readNestedObject(p.transactionInfo) ?? readNestedObject(p.transaction_info);
  return (
    p.meterValue ??
    p.meterValues ??
    p.meter_value ??
    p.meter_values ??
    p.meterValueArray ??
    p.meter_value_array ??
    info?.meterValue ??
    info?.meterValues ??
    info?.meter_value ??
    info?.meter_values ??
    undefined
  );
}

function readSampleUnit(sample: Record<string, unknown>): string {
  const uom = readNestedObject(sample.unitOfMeasure) ?? readNestedObject(sample.unit_of_measure);
  const raw = sample.unit ?? sample.Unit ?? uom?.unit ?? uom?.Unit ?? '';
  return String(raw ?? '').trim().toLowerCase();
}

/**
 * OCPP unitOfMeasure.multiplier: physical = value × 10^multiplier.
 * Missing/invalid → 0 (identity). Parity with server webhook energy extract.
 */
function readSampleMultiplier(sample: Record<string, unknown>): number {
  const uom = readNestedObject(sample.unitOfMeasure) ?? readNestedObject(sample.unit_of_measure);
  if (!uom) return 0;
  const m = uom.multiplier ?? uom.Multiplier;
  if (m == null || m === '') return 0;
  const n = Number(m);
  return Number.isFinite(n) ? n : 0;
}

function scaleSampleValue(raw: number, sample: Record<string, unknown>): number {
  return raw * 10 ** readSampleMultiplier(sample);
}

function readSampleMeasurand(sample: Record<string, unknown>): string {
  const raw = sample.measurand ?? sample.Measurand ?? '';
  return String(raw ?? '').trim().toLowerCase();
}

function readSampleValue(sample: Record<string, unknown>): number | undefined {
  return readOptionalFiniteNumber(sample.value);
}

const POWER_IMPORT_MEASURANDS = new Set([
  'power.active.import',
  'power.active.import.l1',
]);
const POWER_W_UNITS = new Set(['w', 'watt']);
const POWER_KW_UNITS = new Set(['kw', 'k.w', 'kilowatt']);

function iterSampledValues(
  meterValue: unknown,
  visit: (sample: Record<string, unknown>) => void
): void {
  if (!Array.isArray(meterValue)) return;
  for (const entry of meterValue) {
    if (!isPlainObject(entry)) continue;
    const samples = entry.sampledValue ?? entry.sampled_value;
    if (!Array.isArray(samples)) continue;
    for (const sample of samples) {
      if (!isPlainObject(sample)) continue;
      visit(sample);
    }
  }
}

const ENERGY_KWH_UNITS = new Set(['kwh', 'kw.h', 'kilowatthour']);
const ENERGY_WH_UNITS = new Set(['wh', 'w.h', 'watthour', '']);

/**
 * Pull Energy.Active.Import.Register from meterValue arrays (Wh or kWh).
 * Last valid sample wins (monotonic register semantics at the edge).
 * Empty unit defaults to Wh (OCPP). Honors unitOfMeasure.multiplier (value × 10^m).
 * Non-energy units (A/V/W/…) are skipped (aligns with citrineos-core #871 /
 * server webhook extract — do not invent kWh).
 */
export function extractEnergyKwhFromMeterValue(meterValue: unknown): number | undefined {
  let energyKwh: number | undefined;
  iterSampledValues(meterValue, (sample) => {
    const measurand = readSampleMeasurand(sample);
    if (measurand !== 'energy.active.import.register') return;
    const raw = readSampleValue(sample);
    if (raw === undefined) return;
    const eUnit = readSampleUnit(sample);
    if (!ENERGY_KWH_UNITS.has(eUnit) && !ENERGY_WH_UNITS.has(eUnit)) return;
    const scaled = scaleSampleValue(raw, sample);
    energyKwh = ENERGY_WH_UNITS.has(eUnit) ? scaled / 1000 : scaled;
  });
  return energyKwh;
}

/**
 * Pull Power.Active.Import (or .L1) and normalize to kW.
 * Measurand match is case-insensitive (some stacks emit power.active.import).
 * Honors unitOfMeasure.multiplier before unit conversion.
 * Heuristic: unit W/watt, or missing unit with scaled value > 100 → treat as W.
 */
export function extractPowerKwFromMeterValue(meterValue: unknown): number {
  let powerValue = 0;
  let unit = '';
  let found = false;
  iterSampledValues(meterValue, (sample) => {
    if (found) return;
    const measurand = readSampleMeasurand(sample);
    if (!POWER_IMPORT_MEASURANDS.has(measurand)) return;
    const raw = readSampleValue(sample);
    if (raw === undefined) return;
    powerValue = scaleSampleValue(raw, sample);
    unit = readSampleUnit(sample);
    found = true;
  });

  if (!found) return 0;

  if (POWER_W_UNITS.has(unit) || (!unit && powerValue > 100)) {
    return powerValue / 1000;
  }
  // Explicit kW (and default small values without unit) stay as kW.
  if (!unit || POWER_KW_UNITS.has(unit)) {
    return powerValue;
  }
  // Unknown power unit — do not invent kW from amps/volts.
  return 0;
}

/**
 * meterStart for StartTransaction / TransactionEvent Started.
 * Prefers flat meterStart; falls back to energy register in meterValue.
 */
export function extractMeterStartKwh(payload: unknown): number {
  const p = isPlainObject(payload) ? payload : null;
  if (p) {
    if (p.meterStart !== undefined) {
      const n = Number(p.meterStart);
      if (Number.isFinite(n)) return n;
    }
    if (p.meter_start !== undefined) {
      const n = Number(p.meter_start);
      if (Number.isFinite(n)) return n;
    }
  }
  const fromMeter = extractEnergyKwhFromMeterValue(extractMeterValueArray(payload));
  return fromMeter !== undefined && Number.isFinite(fromMeter) ? fromMeter : 0;
}

/**
 * meterStop for StopTransaction / TransactionEvent Ended.
 * Prefers flat meterStop; falls back to energy register (OCPP 2.x Ended).
 */
export function extractMeterStopKwh(payload: unknown): number | undefined {
  const p = isPlainObject(payload) ? payload : null;
  if (p) {
    if (p.meterStop !== undefined) {
      const n = Number(p.meterStop);
      if (Number.isFinite(n)) return n;
    }
    if (p.meter_stop !== undefined) {
      const n = Number(p.meter_stop);
      if (Number.isFinite(n)) return n;
    }
  }
  return extractEnergyKwhFromMeterValue(extractMeterValueArray(payload));
}

/**
 * TransactionEvent eventType (Started|Updated|Ended), case-insensitive.
 * Accepts event_type snake alias. Returns lower-case or empty string.
 */
export function extractTransactionEventType(payload: unknown): string {
  const p = isPlainObject(payload) ? payload : null;
  if (!p) return '';
  const raw = p.eventType ?? p.event_type ?? '';
  return String(raw).trim().toLowerCase();
}

/** Bundle of ids commonly needed by start/stop/meter handlers. */
export function extractOcppTransactionIds(
  message: unknown,
  payload: unknown
): OcppTransactionIds {
  return {
    stationId: extractStationId(message, payload),
    connectorId: extractConnectorId(payload),
    transactionId: extractTransactionId(payload),
    idTag: extractIdTag(payload),
  };
}
