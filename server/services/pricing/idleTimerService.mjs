/**
 * Idle Timer Service – überwacht Sessions für Blockiergebühren.
 *
 * Quelle: feature/monetization-logic → idle-timer-service.ts
 * Idle beginnt nur nach OCPP-State-Wechsel (Charging → SuspendedEV/SuspendedEVSE/Idle),
 * nicht bei konstanten MeterValues. Siehe docs/dynamic-pricing-engine.md.
 */

import { deriveIdleIntervals, durationSeconds } from './events.mjs';
import { calculateSession } from './pricingEngine.mjs';
import { logBillingEvent } from './billingAuditLogger.mjs';

/**
 * @typedef {object} IdleSessionState
 * @property {string} sessionId
 * @property {string} [chargerId]
 * @property {import('./types.mjs').SessionPricingEvent[]} events
 * @property {object} [tariff] – ChargingTariff für Vorschau
 */

/** @type {Map<string, IdleSessionState>} */
const activeSessions = new Map();
/** Letzte geloggte billable Idle-Minute pro Session (gegen Audit-Spam). */
const lastLoggedBillableMin = new Map();

/**
 * Session-Zustand aktualisieren (Events inkl. charging_state).
 * @param {IdleSessionState} state
 */
export function updateSessionState(state) {
  if (!state?.sessionId) throw new Error('sessionId erforderlich');
  activeSessions.set(state.sessionId, {
    sessionId: state.sessionId,
    chargerId: state.chargerId,
    events: Array.isArray(state.events) ? state.events : [],
    tariff: state.tariff,
  });
}

export function clearSession(sessionId) {
  activeSessions.delete(sessionId);
  lastLoggedBillableMin.delete(sessionId);
}

export function getTrackedSessionIds() {
  return [...activeSessions.keys()];
}

/**
 * Bewertet Idle für alle getrackten Sessions.
 * @param {object} [defaultTariff] Fallback-Tarif
 * @param {string} [asOf] ISO-Zeitpunkt
 * @returns {Promise<object[]>}
 */
export async function evaluateIdleSessions(defaultTariff, asOf = new Date().toISOString()) {
  /** @type {object[]} */
  const results = [];

  for (const [sessionId, state] of activeSessions) {
    const tariff = state.tariff ?? defaultTariff;
    if (!tariff) continue;

    const intervals = deriveIdleIntervals(state.events);
    if (!intervals.length) continue;

    const graceSeconds = Math.round((Number(tariff.gracePeriodMinutes) || 0) * 60);
    let idleSeconds = 0;
    for (const iv of intervals) {
      const end = iv.end ?? asOf;
      idleSeconds += Math.max(0, durationSeconds(iv.start, end) - graceSeconds);
    }
    if (idleSeconds <= 0) continue;

    const idleMinutes = idleSeconds / 60;
    const blockingMinutes =
      idleMinutes + (Number(tariff.gracePeriodMinutes) || 0);

    const calc = calculateSession(tariff, 0, 0, blockingMinutes);
    const billableMin = Math.floor(calc.idleBillableMinutes);
    const prev = lastLoggedBillableMin.get(sessionId) ?? -1;

    if (billableMin > prev) {
      await logBillingEvent(sessionId, 'BLOCK_FEE', calc.blockFeeCost, {
        idleSeconds,
        idleBillableMinutes: calc.idleBillableMinutes,
        chargerId: state.chargerId,
        tariffId: tariff.id,
        source: 'idle_timer',
      });
      lastLoggedBillableMin.set(sessionId, billableMin);
    }

    results.push({
      sessionId,
      idleSeconds,
      blockFeeCost: calc.blockFeeCost,
      idleBillableMinutes: calc.idleBillableMinutes,
      audited: billableMin > prev,
    });
  }

  return results;
}

/** Klassen-API (Prototype-Kompatibilität) */
export class IdleTimerService {
  constructor(_pricingEngine) {
    /* pricingEngine optional – calculateSession ist modul-lokal */
  }

  updateSessionState(state) {
    updateSessionState(state);
  }

  clearSession(sessionId) {
    clearSession(sessionId);
  }

  evaluateIdleSessions(tariff) {
    return evaluateIdleSessions(tariff);
  }
}
