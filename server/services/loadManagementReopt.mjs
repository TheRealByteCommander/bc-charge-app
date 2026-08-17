/**
 * Bridge: CitrineOS TransactionEvent triggerReason → Load-Management re-opt.
 * ChargingRateChanged / limit-related reasons → GetCompositeSchedule refresh.
 *
 * Fire-and-forget from webhooks; never fails the user-facing webhook path.
 */

import logger from '../utils/logger.mjs';
import { safeParseJson } from '../utils/safeJson.mjs';
import {
  isLoadManagementEnabled,
  loadManagementFetch,
} from './loadManagementClient.mjs';

/** OCPP 2.0.1 TransactionEvent reasons that imply effective rate/limit may have changed. */
export const LM_REOPT_TRIGGER_REASONS = Object.freeze([
  'ChargingRateChanged',
  'ChargingStateChanged',
  'LimitSet',
  'TxProfile',
]);

const DEFAULT_DEBOUNCE_MS = 15_000;
/** After a failed LM call, allow retry sooner than full success debounce. */
const DEFAULT_FAIL_BACKOFF_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 12_000;

/** @type {Map<string, number>} stationId → last reopt attempt ms */
const lastReoptAt = new Map();

/**
 * Record debounce timestamp. On failure use short backoff so transient LM/OCPP
 * errors can retry on the next ChargingRateChanged (success keeps full window).
 * @param {string} key
 * @param {number} now
 * @param {{ ok: boolean, debounceMs?: number, failBackoffMs?: number }} opts
 */
function markReoptAttempt(key, now, opts) {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const failBackoffMs = opts.failBackoffMs ?? DEFAULT_FAIL_BACKOFF_MS;
  if (opts.ok) {
    lastReoptAt.set(key, now);
    return;
  }
  // next allowed at now + failBackoffMs  ⇔  stored = now - debounceMs + failBackoffMs
  lastReoptAt.set(key, now - debounceMs + Math.max(0, failBackoffMs));
}

/**
 * @param {unknown} triggerReason
 * @returns {boolean}
 */
export function shouldTriggerLmReopt(triggerReason) {
  if (typeof triggerReason !== 'string') return false;
  const t = triggerReason.trim();
  if (!t) return false;
  return LM_REOPT_TRIGGER_REASONS.some((r) => r.toLowerCase() === t.toLowerCase());
}

/**
 * Collect unique station ids from webhook event + session data_json / row columns.
 * @param {{
 *   event?: { stationId?: string|number|null },
 *   sessionRows?: Array<Record<string, unknown>>,
 *   stationIds?: Array<string|number|null|undefined>,
 * }} input
 * @returns {string[]}
 */
export function resolveStationIdsForReopt(input = {}) {
  const out = new Set();

  const push = (raw) => {
    if (raw == null || raw === '') return;
    const s = String(raw).trim();
    if (s) out.add(s);
  };

  push(input.event?.stationId);
  if (Array.isArray(input.stationIds)) {
    for (const id of input.stationIds) push(id);
  }

  if (Array.isArray(input.sessionRows)) {
    for (const row of input.sessionRows) {
      if (!row || typeof row !== 'object') continue;
      push(/** @type {any} */ (row).station_id);
      push(/** @type {any} */ (row).stationId);

      let data = /** @type {any} */ (row).data_json;
      if (typeof data === 'string') {
        data = safeParseJson(data, null);
      }
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        push(data.stationId);
        push(data.station_id);
        push(data.citrineosStationId);
        push(data.connectionName);
      }
    }
  }

  return [...out];
}

/**
 * @param {string} stationId
 * @param {{ now?: number, debounceMs?: number }} [opts]
 */
export function isReoptDebounced(stationId, opts = {}) {
  const now = opts.now ?? Date.now();
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const prev = lastReoptAt.get(stationId);
  if (prev != null && now - prev < debounceMs) return true;
  return false;
}

/** Test helper — clear in-memory debounce map. */
export function resetLmReoptDebounce() {
  lastReoptAt.clear();
}

/**
 * Request GetCompositeSchedule for one station via LM admin API.
 * @param {string} stationId
 * @param {{ timeoutMs?: number, durationSeconds?: number }} [opts]
 */
export async function requestCompositeRefreshForStation(stationId, opts = {}) {
  const id = encodeURIComponent(String(stationId));
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return loadManagementFetch(`/api/load/composite-schedules/${id}`, {
    method: 'POST',
    body: {
      durationSeconds:
        typeof opts.durationSeconds === 'number' ? opts.durationSeconds : 3600,
      chargingRateUnit: 'W',
      evseId: 0,
      timeoutMs,
    },
    timeoutMs: timeoutMs + 2_000,
  });
}

/**
 * Best-effort site-wide composite refresh when station is unknown.
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function requestCompositeRefreshAll(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  return loadManagementFetch('/api/load/composite-schedules', {
    method: 'POST',
    body: {
      durationSeconds: 3600,
      chargingRateUnit: 'W',
    },
    timeoutMs,
  });
}

/**
 * Main entry from webhook path after session apply.
 * @param {{
 *   triggerReason?: string|null,
 *   stationIds?: string[],
 *   transactionId?: string|null,
 *   debounceMs?: number,
 *   failBackoffMs?: number,
 *   now?: number,
 *   force?: boolean,
 * }} input
 * @returns {Promise<{
 *   attempted: boolean,
 *   skipped?: string,
 *   stations: string[],
 *   results: Array<{ stationId: string|null, ok: boolean, status?: number, error?: string|null }>,
 * }>}
 */
export async function triggerLmReoptFromWebhook(input = {}) {
  const triggerReason = input.triggerReason ?? null;
  if (!shouldTriggerLmReopt(triggerReason)) {
    return { attempted: false, skipped: 'trigger_not_reopt', stations: [], results: [] };
  }

  if (!isLoadManagementEnabled()) {
    return { attempted: false, skipped: 'lm_disabled', stations: [], results: [] };
  }

  const stations = Array.isArray(input.stationIds)
    ? [...new Set(input.stationIds.map((s) => String(s).trim()).filter(Boolean))]
    : [];

  const now = input.now ?? Date.now();
  const debounceMs = input.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const force = Boolean(input.force);

  /** @type {Array<{ stationId: string|null, ok: boolean, status?: number, error?: string|null }>} */
  const results = [];

  const failBackoffMs =
    typeof input.failBackoffMs === 'number' ? input.failBackoffMs : DEFAULT_FAIL_BACKOFF_MS;

  if (stations.length === 0) {
    // No station on event/session — refresh all known LM stations (debounced under "*").
    if (!force && isReoptDebounced('*', { now, debounceMs })) {
      return {
        attempted: false,
        skipped: 'debounced',
        stations: [],
        results: [],
      };
    }
    // Stampede guard before await; success keeps full window, failure short backoff.
    markReoptAttempt('*', now, { ok: true, debounceMs, failBackoffMs });
    logger.info('[LM reopt] ChargingRateChanged without stationId — refresh all', {
      triggerReason,
      transactionId: input.transactionId ?? null,
    });
    const r = await requestCompositeRefreshAll();
    markReoptAttempt('*', now, { ok: r.ok, debounceMs, failBackoffMs });
    results.push({
      stationId: null,
      ok: r.ok,
      status: r.status,
      error: r.error,
    });
    return { attempted: true, stations: [], results };
  }

  const toRun = [];
  for (const stationId of stations) {
    if (!force && isReoptDebounced(stationId, { now, debounceMs })) {
      results.push({
        stationId,
        ok: false,
        error: 'debounced',
      });
      continue;
    }
    // Optimistic stampede guard (overwritten with failure backoff if call fails).
    markReoptAttempt(stationId, now, { ok: true, debounceMs, failBackoffMs });
    toRun.push(stationId);
  }

  if (toRun.length === 0) {
    return {
      attempted: false,
      skipped: 'debounced',
      stations,
      results,
    };
  }

  logger.info('[LM reopt] GetCompositeSchedule after rate/limit trigger', {
    triggerReason,
    transactionId: input.transactionId ?? null,
    stations: toRun,
  });

  await Promise.all(
    toRun.map(async (stationId) => {
      const r = await requestCompositeRefreshForStation(stationId);
      markReoptAttempt(stationId, now, { ok: r.ok, debounceMs, failBackoffMs });
      results.push({
        stationId,
        ok: r.ok,
        status: r.status,
        error: r.error,
      });
      if (!r.ok) {
        logger.warn('[LM reopt] composite refresh failed', {
          stationId,
          status: r.status,
          error: r.error,
        });
      }
    })
  );

  return { attempted: true, stations: toRun, results };
}

export default {
  LM_REOPT_TRIGGER_REASONS,
  shouldTriggerLmReopt,
  resolveStationIdsForReopt,
  isReoptDebounced,
  resetLmReoptDebounce,
  requestCompositeRefreshForStation,
  requestCompositeRefreshAll,
  triggerLmReoptFromWebhook,
};
