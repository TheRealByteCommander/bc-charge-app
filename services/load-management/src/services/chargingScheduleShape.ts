/**
 * Parse-don't-cast helpers for OCPP ChargingSchedule / CompositeSchedule shapes.
 * Tolerates camelCase + snake_case aliases from CitrineOS/Hasura envelopes.
 */

export type ChargingSchedulePeriodLike = {
  startPeriod: number;
  limit: number;
  numberPhases?: number;
};

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function readChargingRateUnit(
  schedule: unknown,
  fallbackUnit = 'W'
): string {
  const fallback = fallbackUnit && String(fallbackUnit).trim() ? String(fallbackUnit) : 'W';
  if (!isPlainObject(schedule)) return fallback.toUpperCase();
  const raw =
    schedule.chargingRateUnit ?? schedule.charging_rate_unit ?? fallback;
  const unit = String(raw ?? fallback).trim() || fallback;
  return unit.toUpperCase();
}

export function readChargingSchedulePeriods(schedule: unknown): unknown[] {
  if (!isPlainObject(schedule)) return [];
  const periods =
    schedule.chargingSchedulePeriod ?? schedule.charging_schedule_period;
  return Array.isArray(periods) ? periods : [];
}

export function normalizeChargingSchedulePeriod(
  value: unknown
): ChargingSchedulePeriodLike | null {
  if (!isPlainObject(value)) return null;
  const limit = Number(value.limit);
  if (!Number.isFinite(limit)) return null;
  const startRaw = value.startPeriod ?? value.start_period ?? 0;
  const startPeriodNum = Number(startRaw);
  const startPeriod = Number.isFinite(startPeriodNum) ? startPeriodNum : 0;
  const phasesRaw = value.numberPhases ?? value.number_phases;
  let numberPhases: number | undefined;
  if (phasesRaw != null) {
    const n = Number(phasesRaw);
    if (Number.isFinite(n)) numberPhases = n;
  }
  return numberPhases !== undefined
    ? { startPeriod, limit, numberPhases }
    : { startPeriod, limit };
}

/**
 * Lowest period limit converted to kW.
 * - W → /1000
 * - A → A * 230V * phases / 1000 (default 3 phases)
 * - other (incl. kW) → raw limit
 */
export function deriveLimitKwFromSchedule(
  schedule: unknown,
  fallbackUnit?: string
): number | null {
  if (schedule == null) return null;
  const schedules = Array.isArray(schedule) ? schedule : [schedule];
  let minKw: number | null = null;

  for (const sch of schedules) {
    if (!isPlainObject(sch)) continue;
    const unit = readChargingRateUnit(sch, fallbackUnit);
    for (const rawPeriod of readChargingSchedulePeriods(sch)) {
      const period = normalizeChargingSchedulePeriod(rawPeriod);
      if (!period) continue;
      let kw = period.limit;
      if (unit === 'W') {
        kw = period.limit / 1000;
      } else if (unit === 'A') {
        const phases = period.numberPhases && period.numberPhases > 0 ? period.numberPhases : 3;
        kw = (period.limit * 230 * phases) / 1000;
      }
      if (minKw == null || kw < minKw) minKw = kw;
    }
  }
  return minKw;
}

/** Prefer nested schedule fields used by GetCompositeSchedule / NotifyChargingLimit. */
export function extractChargingScheduleFromPayload(payload: unknown): unknown {
  if (!isPlainObject(payload)) return null;
  return (
    payload.schedule ??
    payload.chargingSchedule ??
    payload.charging_schedule ??
    payload.compositeSchedule ??
    payload.composite_schedule ??
    null
  );
}

export function readOptionalFiniteNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const t = value.trim();
  return t ? t : undefined;
}
