import { OCPP_CHARGING_STATES, OCPP_IDLE_STATES } from './types.mjs';

/**
 * True when `at` is a non-empty string that parses to a finite epoch ms.
 * Webhook/track callers may send sparse rows; never throw on sort/compare.
 * @param {unknown} at
 * @returns {at is string}
 */
export function isValidEventAt(at) {
  if (typeof at !== 'string') return false;
  const t = at.trim();
  if (!t) return false;
  const ms = Date.parse(t);
  return Number.isFinite(ms);
}

/**
 * Drop nullish / incomplete pricing events and sort chronologically by `at`.
 * Invalid timestamps are dropped (not ordered as "epoch 0").
 * @param {unknown} events
 * @returns {import('./types.mjs').SessionPricingEvent[]}
 */
export function normalizePricingEvents(events) {
  if (!Array.isArray(events)) return [];
  /** @type {import('./types.mjs').SessionPricingEvent[]} */
  const out = [];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) continue;
    const row = /** @type {Record<string, unknown>} */ (ev);
    if (typeof row.type !== 'string' || !row.type.trim()) continue;
    if (!isValidEventAt(row.at)) continue;
    out.push(/** @type {import('./types.mjs').SessionPricingEvent} */ (ev));
  }
  out.sort((a, b) => {
    const am = Date.parse(a.at);
    const bm = Date.parse(b.at);
    if (am !== bm) return am - bm;
    // Stable-ish tie-break for identical timestamps.
    return String(a.type).localeCompare(String(b.type));
  });
  return out;
}

/**
 * Leitet Idle-Intervalle aus belastbaren OCPP-Ereignissen ab.
 *
 * Idle beginnt nur nach aktivem Laden (Charging/EVConnected) und Wechsel in
 * SuspendedEV, SuspendedEVSE oder Idle. Konstante MeterValues ohne charging_state
 * lösen keine Idle-Gebühr aus (siehe docs/dynamic-pricing-engine.md).
 *
 * @param {import('./types.mjs').SessionPricingEvent[]} events chronologisch
 */
export function deriveIdleIntervals(events) {
  /** @type {{ start: string, end: string|null }[]} */
  const intervals = [];
  let idleStart = null;
  let wasCharging = false;

  for (const ev of normalizePricingEvents(events)) {
    if (ev.type === 'session_start' || ev.type === 'authorization') {
      wasCharging = false;
      continue;
    }

    if (ev.type === 'charging_state' && ev.chargingState) {
      const state = ev.chargingState;
      if (OCPP_CHARGING_STATES.has(state)) {
        if (idleStart) {
          intervals.push({ start: idleStart, end: ev.at });
          idleStart = null;
        }
        wasCharging = true;
      } else if (OCPP_IDLE_STATES.has(state) && wasCharging) {
        idleStart = ev.at;
      }
    }

    if (ev.type === 'session_stop' && idleStart) {
      intervals.push({ start: idleStart, end: ev.at });
      idleStart = null;
    }
  }

  if (idleStart) {
    intervals.push({ start: idleStart, end: null });
  }

  return intervals;
}

export function deriveChargingWindow(events) {
  const sorted = normalizePricingEvents(events);
  const start = sorted.find((e) => e.type === 'session_start' || e.type === 'authorization')?.at;
  const stop = sorted.find((e) => e.type === 'session_stop')?.at;
  return { start, stop };
}

/** Letzter signierter/kumulativer Meterstand (bevorzugt midCertified). */
export function latestEnergyWh(events) {
  let best = null;
  for (const ev of normalizePricingEvents(events)) {
    if (ev.type !== 'meter_value' || ev.energyWh == null) continue;
    const wh = Number(ev.energyWh);
    if (!Number.isFinite(wh) || wh < 0) continue;
    if (ev.midCertified || best == null) best = wh;
  }
  return best ?? 0;
}

export function durationSeconds(fromIso, toIso) {
  if (!fromIso || !toIso) return 0;
  const fromMs = typeof fromIso === 'string' || typeof fromIso === 'number' ? Date.parse(String(fromIso)) : NaN;
  const toMs = typeof toIso === 'string' || typeof toIso === 'number' ? Date.parse(String(toIso)) : NaN;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 0;
  return Math.max(0, Math.floor((toMs - fromMs) / 1000));
}
