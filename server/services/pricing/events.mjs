import { OCPP_CHARGING_STATES, OCPP_IDLE_STATES } from './types.mjs';

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

  for (const ev of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
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
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const start = sorted.find((e) => e.type === 'session_start' || e.type === 'authorization')?.at;
  const stop = sorted.find((e) => e.type === 'session_stop')?.at;
  return { start, stop };
}

/** Letzter signierter/kumulativer Meterstand (bevorzugt midCertified). */
export function latestEnergyWh(events) {
  let best = null;
  for (const ev of events) {
    if (ev.type !== 'meter_value' || ev.energyWh == null) continue;
    if (ev.midCertified || best == null) best = ev.energyWh;
  }
  return best ?? 0;
}

export function durationSeconds(fromIso, toIso) {
  if (!fromIso || !toIso) return 0;
  return Math.max(0, Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000));
}
